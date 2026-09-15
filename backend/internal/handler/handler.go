package handler

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/it-connect/access-management/internal/auth"
	"github.com/it-connect/access-management/internal/config"
	"github.com/it-connect/access-management/internal/domain"
	"github.com/it-connect/access-management/internal/repository"
)

type Handler struct {
	Repo *repository.Repository
	Cfg  config.Config
}

func New(repo *repository.Repository, cfg config.Config) *Handler {
	return &Handler{Repo: repo, Cfg: cfg}
}

const (
	errSuperAdminRole    = "only a super admin can assign the super admin role"
	errSuperAdminAccount = "only a super admin can modify a super admin account"
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func respondError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"error": message})
}

// fail maps a repository error to a response. Unexpected errors are logged and never exposed.
func fail(c *gin.Context, err error, notFoundMsg, conflictMsg string) {
	var inUse *repository.DepartmentInUseError
	switch {
	case errors.Is(err, repository.ErrNotFound) && notFoundMsg != "":
		respondError(c, http.StatusNotFound, notFoundMsg)
	case errors.As(err, &inUse):
		respondError(c, http.StatusConflict, inUse.Error())
	case repository.IsConflict(err) && conflictMsg != "":
		respondError(c, http.StatusConflict, conflictMsg)
	case repository.IsInvalidInput(err):
		respondError(c, http.StatusBadRequest, "invalid payload")
	default:
		slog.Error("request failed", "method", c.Request.Method, "path", c.FullPath(), "error", err)
		respondError(c, http.StatusInternalServerError, "internal server error")
	}
}

func bind(c *gin.Context, dst any) bool {
	if err := c.ShouldBindJSON(dst); err != nil {
		respondError(c, http.StatusBadRequest, "invalid payload")
		return false
	}
	return true
}

// pathID returns the :id parameter, answering 404 when it is not a UUID.
func pathID(c *gin.Context, notFoundMsg string) (string, bool) {
	id := c.Param("id")
	if !uuidPattern.MatchString(id) {
		respondError(c, http.StatusNotFound, notFoundMsg)
		return "", false
	}
	return id, true
}

func caller(c *gin.Context) *auth.Claims {
	return c.MustGet("claims").(*auth.Claims)
}

func (h *Handler) audit(c *gin.Context, action, entity string, id *string, details map[string]any) {
	v, ok := c.Get("claims")
	if !ok {
		return
	}
	if err := h.Repo.AddAudit(c, v.(*auth.Claims).UserID, action, entity, id, details); err != nil {
		slog.Warn("write audit log", "action", action, "entity", entity, "error", err)
	}
}

// ---------------------------------------------------------------- Auth

func (h *Handler) Login(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if !bind(c, &req) {
		return
	}
	hash, u, err := h.Repo.FindLoginUser(c, strings.TrimSpace(req.Username))
	if err != nil || u.Status != domain.StatusActive || !auth.VerifyPassword(hash, req.Password) {
		respondError(c, http.StatusUnauthorized, "invalid credentials")
		return
	}
	token, err := auth.IssueToken(h.Cfg.JWTSecret, u.ID, u.Username, u.Role, h.Cfg.JWTExpiresHours)
	if err != nil {
		fail(c, err, "", "")
		return
	}
	// The login route has no claims yet, so write the audit entry with the user's own ID.
	if err := h.Repo.AddAudit(c, u.ID, "LOGIN", "USER", &u.ID, map[string]any{"username": u.Username}); err != nil {
		slog.Warn("write audit log", "action", "LOGIN", "error", err)
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user": u})
}

func (h *Handler) Me(c *gin.Context) {
	u, err := h.Repo.FindUser(c, caller(c).UserID)
	if err != nil {
		fail(c, err, "user not found", "")
		return
	}
	c.JSON(http.StatusOK, u)
}

// ---------------------------------------------------------------- Companies

func (h *Handler) ListCompanies(c *gin.Context) {
	items, err := h.Repo.ListCompanies(c, c.Query("q"))
	if err != nil {
		fail(c, err, "", "")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) CreateCompany(c *gin.Context) {
	var x domain.Company
	if !bind(c, &x) {
		return
	}
	if err := validateCodeName(x.Code, x.Name); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}
	x.Status = domain.StatusActive
	out, err := h.Repo.CreateCompany(c, x)
	if err != nil {
		fail(c, err, "", "company code or name may already exist")
		return
	}
	h.audit(c, "CREATE", "COMPANY", &out.ID, map[string]any{"name": out.Name})
	c.JSON(http.StatusCreated, out)
}

func (h *Handler) UpdateCompany(c *gin.Context) {
	id, ok := pathID(c, "company not found")
	if !ok {
		return
	}
	var x domain.Company
	if !bind(c, &x) {
		return
	}
	if err := validateCodeName(x.Code, x.Name); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}
	// An empty status keeps the current one.
	out, err := h.Repo.UpdateCompany(c, id, x)
	if err != nil {
		fail(c, err, "company not found", "company code or name may already exist")
		return
	}
	h.audit(c, "UPDATE", "COMPANY", &id, map[string]any{"name": out.Name})
	c.JSON(http.StatusOK, out)
}

func (h *Handler) DeleteCompany(c *gin.Context) {
	id, ok := pathID(c, "company not found")
	if !ok {
		return
	}
	if err := h.Repo.DeleteCompany(c, id); err != nil {
		fail(c, err, "company not found", "")
		return
	}
	h.audit(c, "DELETE", "COMPANY", &id, nil)
	c.Status(http.StatusNoContent)
}

// ---------------------------------------------------------------- Departments

func (h *Handler) ListDepartments(c *gin.Context) {
	items, err := h.Repo.ListDepartments(c, c.Query("company_id"), c.Query("q"))
	if err != nil {
		fail(c, err, "", "")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) CreateDepartment(c *gin.Context) {
	var x domain.Department
	if !bind(c, &x) {
		return
	}
	if strings.TrimSpace(x.CompanyID) == "" || strings.TrimSpace(x.Name) == "" {
		respondError(c, http.StatusBadRequest, "company_id and name are required")
		return
	}
	out, err := h.Repo.CreateDepartment(c, x)
	if err != nil {
		fail(c, err, "", "department may already exist")
		return
	}
	h.audit(c, "CREATE", "DEPARTMENT", &out.ID, map[string]any{"name": out.Name, "company_id": out.CompanyID})
	c.JSON(http.StatusCreated, out)
}

func (h *Handler) UpdateDepartment(c *gin.Context) {
	id, ok := pathID(c, "department not found")
	if !ok {
		return
	}
	var x domain.Department
	if !bind(c, &x) {
		return
	}
	if strings.TrimSpace(x.Name) == "" {
		respondError(c, http.StatusBadRequest, "name is required")
		return
	}
	companyID, err := h.Repo.DepartmentCompany(c, id)
	if err != nil {
		fail(c, err, "department not found", "")
		return
	}
	// Employees reference both company and department, so a department cannot silently change company.
	if x.CompanyID != "" && x.CompanyID != companyID {
		respondError(c, http.StatusBadRequest, "moving a department to another company is not supported")
		return
	}
	out, err := h.Repo.UpdateDepartment(c, id, x)
	if err != nil {
		fail(c, err, "department not found", "department may already exist")
		return
	}
	h.audit(c, "UPDATE", "DEPARTMENT", &id, map[string]any{"name": out.Name})
	c.JSON(http.StatusOK, out)
}

func (h *Handler) DeleteDepartment(c *gin.Context) {
	id, ok := pathID(c, "department not found")
	if !ok {
		return
	}
	if err := h.Repo.DeleteDepartment(c, id); err != nil {
		fail(c, err, "department not found", "")
		return
	}
	h.audit(c, "DELETE", "DEPARTMENT", &id, nil)
	c.Status(http.StatusNoContent)
}

// ---------------------------------------------------------------- Users

func (h *Handler) ListUsers(c *gin.Context) {
	items, err := h.Repo.ListUsers(c, c.Query("q"), c.Query("status"), c.Query("company_id"), c.Query("department_id"))
	if err != nil {
		fail(c, err, "", "")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func requireUserFields(c *gin.Context, u domain.User) bool {
	if strings.TrimSpace(u.EmployeeCode) == "" || strings.TrimSpace(u.Username) == "" || strings.TrimSpace(u.FullName) == "" || strings.TrimSpace(u.CompanyID) == "" {
		respondError(c, http.StatusBadRequest, "employee_code, username, full_name and company_id are required")
		return false
	}
	return true
}

func (h *Handler) CreateUser(c *gin.Context) {
	var req struct {
		domain.User
		Password string `json:"password"`
	}
	if !bind(c, &req) {
		return
	}
	if req.Password == "" {
		respondError(c, http.StatusBadRequest, "password is required for a new employee")
		return
	}
	if !requireUserFields(c, req.User) {
		return
	}
	req.Role = strings.ToUpper(strings.TrimSpace(req.Role))
	if req.Role == "" {
		req.Role = domain.RoleUser
	}
	if !domain.ValidRole(req.Role) {
		respondError(c, http.StatusBadRequest, "invalid role")
		return
	}
	if req.Role == domain.RoleSuperAdmin && caller(c).Role != domain.RoleSuperAdmin {
		respondError(c, http.StatusForbidden, errSuperAdminRole)
		return
	}
	req.Status = domain.StatusActive
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		fail(c, err, "", "")
		return
	}
	u, err := h.Repo.CreateUser(c, req.User, hash)
	if err != nil {
		fail(c, err, "", "username or employee code may already exist")
		return
	}
	h.audit(c, "CREATE", "USER", &u.ID, map[string]any{"username": u.Username, "employee_code": u.EmployeeCode})
	c.JSON(http.StatusCreated, u)
}

func (h *Handler) UpdateUser(c *gin.Context) {
	id, ok := pathID(c, "user not found")
	if !ok {
		return
	}
	var req domain.User
	if !bind(c, &req) {
		return
	}
	if !requireUserFields(c, req) {
		return
	}
	target, err := h.Repo.FindUser(c, id)
	if err != nil {
		fail(c, err, "user not found", "")
		return
	}
	// Omitted role/status keep their current values instead of resetting the account.
	req.Role = strings.ToUpper(strings.TrimSpace(req.Role))
	if req.Role == "" {
		req.Role = target.Role
	}
	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	if req.Status == "" {
		req.Status = target.Status
	}
	if !domain.ValidRole(req.Role) {
		respondError(c, http.StatusBadRequest, "invalid role")
		return
	}
	if !domain.ValidUserStatus(req.Status) {
		respondError(c, http.StatusBadRequest, "invalid status")
		return
	}
	actor := caller(c)
	if actor.Role != domain.RoleSuperAdmin {
		if target.Role == domain.RoleSuperAdmin {
			respondError(c, http.StatusForbidden, errSuperAdminAccount)
			return
		}
		if req.Role == domain.RoleSuperAdmin {
			respondError(c, http.StatusForbidden, errSuperAdminRole)
			return
		}
	}
	if id == actor.UserID && (req.Role != target.Role || req.Status != target.Status) {
		respondError(c, http.StatusForbidden, "you cannot change your own role or status")
		return
	}
	out, err := h.Repo.UpdateUser(c, id, req)
	if err != nil {
		fail(c, err, "user not found", "user update failed, check unique fields and references")
		return
	}
	h.audit(c, "UPDATE", "USER", &id, map[string]any{"username": out.Username})
	c.JSON(http.StatusOK, out)
}

// guardAccountRemoval applies the rules shared by deleting and resigning an account.
func (h *Handler) guardAccountRemoval(c *gin.Context, target domain.User, selfMsg string) bool {
	actor := caller(c)
	switch {
	case target.ID == actor.UserID:
		respondError(c, http.StatusForbidden, selfMsg)
	case target.Role == domain.RoleSuperAdmin && actor.Role != domain.RoleSuperAdmin:
		respondError(c, http.StatusForbidden, errSuperAdminAccount)
	default:
		return true
	}
	return false
}

func (h *Handler) DeleteUser(c *gin.Context) {
	id, ok := pathID(c, "user not found")
	if !ok {
		return
	}
	target, err := h.Repo.FindUser(c, id)
	if err != nil {
		fail(c, err, "user not found", "")
		return
	}
	if !h.guardAccountRemoval(c, target, "you cannot delete your own account") {
		return
	}
	if target.Username == h.Cfg.AdminUsername {
		respondError(c, http.StatusConflict, "the built-in administrator account cannot be deleted")
		return
	}
	if err := h.Repo.DeleteUser(c, id); err != nil {
		fail(c, err, "user not found", "")
		return
	}
	h.audit(c, "DELETE", "USER", &id, map[string]any{"username": target.Username})
	c.Status(http.StatusNoContent)
}

func (h *Handler) ResignUser(c *gin.Context) {
	id, ok := pathID(c, "user not found")
	if !ok {
		return
	}
	var req struct {
		ReplacementUserID *string `json:"replacement_user_id"`
		Note              string  `json:"note"`
	}
	if !bind(c, &req) {
		return
	}
	if req.ReplacementUserID != nil && strings.TrimSpace(*req.ReplacementUserID) == "" {
		req.ReplacementUserID = nil
	}
	target, err := h.Repo.FindUser(c, id)
	if err != nil {
		fail(c, err, "user not found", "")
		return
	}
	if !h.guardAccountRemoval(c, target, "you cannot resign your own account") {
		return
	}
	if target.Status != domain.StatusActive {
		respondError(c, http.StatusConflict, "employee is not active")
		return
	}
	if req.ReplacementUserID != nil {
		if *req.ReplacementUserID == id {
			respondError(c, http.StatusBadRequest, "replacement user cannot be the resigned employee")
			return
		}
		if !uuidPattern.MatchString(*req.ReplacementUserID) {
			respondError(c, http.StatusBadRequest, "replacement user not found")
			return
		}
		replacement, err := h.Repo.FindUser(c, *req.ReplacementUserID)
		if errors.Is(err, repository.ErrNotFound) {
			respondError(c, http.StatusBadRequest, "replacement user not found")
			return
		}
		if err != nil {
			fail(c, err, "", "")
			return
		}
		if replacement.Status != domain.StatusActive {
			respondError(c, http.StatusBadRequest, "replacement user must be an active employee")
			return
		}
	}
	if err := h.Repo.MarkResigned(c, id, req.ReplacementUserID, req.Note); err != nil {
		// ErrNotFound here means the account changed concurrently (deleted or no longer active).
		fail(c, err, "employee is not active", "")
		return
	}
	h.audit(c, "RESIGN", "USER", &id, map[string]any{"replacement_user_id": req.ReplacementUserID, "note": req.Note})
	c.Status(http.StatusNoContent)
}

// ---------------------------------------------------------------- Projects

func (h *Handler) ListProjects(c *gin.Context) {
	items, err := h.Repo.ListProjects(c, c.Query("q"), c.Query("company_id"))
	if err != nil {
		fail(c, err, "", "")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func requireProjectFields(c *gin.Context, p domain.Project) bool {
	if strings.TrimSpace(p.CompanyID) == "" || strings.TrimSpace(p.Code) == "" || strings.TrimSpace(p.Name) == "" {
		respondError(c, http.StatusBadRequest, "company_id, code and name are required")
		return false
	}
	return true
}

func (h *Handler) CreateProject(c *gin.Context) {
	var x domain.Project
	if !bind(c, &x) || !requireProjectFields(c, x) {
		return
	}
	x.Status = domain.StatusActive
	p, err := h.Repo.CreateProject(c, x)
	if err != nil {
		fail(c, err, "", "project code may already exist in this company")
		return
	}
	h.audit(c, "CREATE", "PROJECT", &p.ID, map[string]any{"name": p.Name})
	c.JSON(http.StatusCreated, p)
}

func (h *Handler) UpdateProject(c *gin.Context) {
	id, ok := pathID(c, "project not found")
	if !ok {
		return
	}
	var x domain.Project
	if !bind(c, &x) || !requireProjectFields(c, x) {
		return
	}
	// An empty status keeps the current one.
	p, err := h.Repo.UpdateProject(c, id, x)
	if err != nil {
		fail(c, err, "project not found", "project code may already exist in this company")
		return
	}
	h.audit(c, "UPDATE", "PROJECT", &id, map[string]any{"name": p.Name})
	c.JSON(http.StatusOK, p)
}

func (h *Handler) DeleteProject(c *gin.Context) {
	id, ok := pathID(c, "project not found")
	if !ok {
		return
	}
	if err := h.Repo.DeleteProject(c, id); err != nil {
		fail(c, err, "project not found", "")
		return
	}
	h.audit(c, "DELETE", "PROJECT", &id, nil)
	c.Status(http.StatusNoContent)
}

// ---------------------------------------------------------------- Permissions

func (h *Handler) ListPermissions(c *gin.Context) {
	items, err := h.Repo.ListPermissions(c, c.Query("user_id"), c.Query("project_id"))
	if err != nil {
		fail(c, err, "", "")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) SetPermission(c *gin.Context) {
	var x domain.Permission
	if !bind(c, &x) {
		return
	}
	if x.UserID == "" || x.ProjectID == "" {
		respondError(c, http.StatusBadRequest, "user_id and project_id are required")
		return
	}
	if !uuidPattern.MatchString(x.UserID) || !uuidPattern.MatchString(x.ProjectID) || (x.ResourceID != nil && !uuidPattern.MatchString(*x.ResourceID)) {
		respondError(c, http.StatusBadRequest, "invalid payload")
		return
	}
	level, ok := normalizeLevel(x.Level)
	if !ok {
		respondError(c, http.StatusBadRequest, "level must be NONE, READ or WRITE")
		return
	}
	x.Level = level
	userStatus, projectExists, err := h.Repo.PermissionTargets(c, x.UserID, x.ProjectID)
	if err != nil {
		fail(c, err, "", "")
		return
	}
	if userStatus == nil {
		respondError(c, http.StatusNotFound, "user not found")
		return
	}
	if !projectExists {
		respondError(c, http.StatusNotFound, "project not found")
		return
	}
	// Revoking (NONE) is always allowed so access can be cleaned up after someone leaves.
	if x.Level != "NONE" && *userStatus != domain.StatusActive {
		respondError(c, http.StatusConflict, "cannot grant access to an inactive employee")
		return
	}
	p, err := h.Repo.UpsertPermission(c, x)
	if err != nil {
		fail(c, err, "", "permission save failed, check user/project/resource references")
		return
	}
	h.audit(c, "SET_PERMISSION", "PERMISSION", &p.ID, map[string]any{"user_id": p.UserID, "project_id": p.ProjectID, "level": p.Level})
	c.JSON(http.StatusOK, p)
}

// ---------------------------------------------------------------- Audit & dashboard

func (h *Handler) ListAudit(c *gin.Context) {
	items, err := h.Repo.ListAudit(c, 100)
	if err != nil {
		fail(c, err, "", "")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) Dashboard(c *gin.Context) {
	var users, companies, projects, resigned int
	err := h.Repo.DB.QueryRow(c, `
		SELECT
			(SELECT COUNT(*) FROM users WHERE deleted_at IS NULL),
			(SELECT COUNT(*) FROM companies WHERE deleted_at IS NULL),
			(SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL),
			(SELECT COUNT(*) FROM users WHERE status = 'RESIGNED' AND deleted_at IS NULL)`,
	).Scan(&users, &companies, &projects, &resigned)
	if err != nil {
		fail(c, err, "", "")
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": users, "companies": companies, "projects": projects, "resigned": resigned})
}

func validateCodeName(code, name string) error {
	if strings.TrimSpace(code) == "" || strings.TrimSpace(name) == "" {
		return fmt.Errorf("code and name are required")
	}
	return nil
}

func normalizeLevel(level string) (string, bool) {
	switch strings.ToUpper(strings.TrimSpace(level)) {
	case "R", "READ":
		return "READ", true
	case "W", "WRITE":
		return "WRITE", true
	case "X", "NONE", "DENY":
		return "NONE", true
	default:
		return "", false
	}
}
