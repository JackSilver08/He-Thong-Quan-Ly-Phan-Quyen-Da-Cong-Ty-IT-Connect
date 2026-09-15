package handler

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/it-connect/access-management/internal/auth"
	"github.com/it-connect/access-management/internal/config"
	"github.com/it-connect/access-management/internal/domain"
	"github.com/it-connect/access-management/internal/repository"
)

type Handler struct { Repo *repository.Repository; Cfg config.Config }
func New(repo *repository.Repository,cfg config.Config)*Handler{return &Handler{Repo:repo,Cfg:cfg}}

func (h *Handler) Login(c *gin.Context){
	var req struct{Username string `json:"username"`;Password string `json:"password"`}
	if err:=c.ShouldBindJSON(&req);err!=nil{c.JSON(400,gin.H{"error":"invalid payload"});return}
	hash,u,err:=h.Repo.FindLoginUser(c,strings.TrimSpace(req.Username))
	if err!=nil||u.Status!="ACTIVE"||!auth.VerifyPassword(hash,req.Password){c.JSON(401,gin.H{"error":"invalid credentials"});return}
	token,err:=auth.IssueToken(h.Cfg.JWTSecret,u.ID,u.Username,u.Role,h.Cfg.JWTExpiresHours);if err!=nil{c.JSON(500,gin.H{"error":"token issue failed"});return}
	_ = h.Repo.AddAudit(c,u.ID,"LOGIN","USER",&u.ID,map[string]any{"username":u.Username})
	c.JSON(200,gin.H{"token":token,"user":u})
}
func(h *Handler)Me(c *gin.Context){cl:=c.MustGet("claims").(*auth.Claims);_,u,err:=h.Repo.FindLoginUser(c,cl.Username);if err!=nil{c.JSON(404,gin.H{"error":"user not found"});return};c.JSON(200,u)}

func(h *Handler)ListCompanies(c *gin.Context){items,err:=h.Repo.ListCompanies(c,c.Query("q"));if err!=nil{c.JSON(500,gin.H{"error":err.Error()});return};c.JSON(200,gin.H{"data":items})}
func(h *Handler)CreateCompany(c *gin.Context){var x domain.Company;if err:=c.ShouldBindJSON(&x);err!=nil{c.JSON(400,gin.H{"error":"invalid payload"});return};x.Status="ACTIVE";if err:=validateCodeName(x.Code,x.Name);err!=nil{c.JSON(400,gin.H{"error":err.Error()});return};out,err:=h.Repo.CreateCompany(c,x);if err!=nil{c.JSON(409,gin.H{"error":"company code or name may already exist"});return};h.audit(c,"CREATE","COMPANY",&out.ID,map[string]any{"name":out.Name});c.JSON(201,out)}
func(h *Handler)UpdateCompany(c *gin.Context){var x domain.Company;if err:=c.ShouldBindJSON(&x);err!=nil{c.JSON(400,gin.H{"error":"invalid payload"});return};if err:=validateCodeName(x.Code,x.Name);err!=nil{c.JSON(400,gin.H{"error":err.Error()});return};if x.Status==""{x.Status="ACTIVE"};id:=c.Param("id");out,err:=h.Repo.UpdateCompany(c,id,x);if err!=nil{c.JSON(409,gin.H{"error":"company code or name may already exist"});return};h.audit(c,"UPDATE","COMPANY",&id,map[string]any{"name":out.Name});c.JSON(200,out)}
func(h *Handler)DeleteCompany(c *gin.Context){id:=c.Param("id");if err:=h.Repo.DeleteCompany(c,id);err!=nil{c.JSON(500,gin.H{"error":err.Error()});return};h.audit(c,"DELETE","COMPANY",&id,nil);c.Status(204)}

func(h *Handler)ListDepartments(c *gin.Context){items,err:=h.Repo.ListDepartments(c,c.Query("company_id"),c.Query("q"));if err!=nil{c.JSON(500,gin.H{"error":err.Error()});return};c.JSON(200,gin.H{"data":items})}
func(h *Handler)CreateDepartment(c *gin.Context){var x domain.Department;if err:=c.ShouldBindJSON(&x);err!=nil{c.JSON(400,gin.H{"error":"invalid payload"});return};if strings.TrimSpace(x.CompanyID)==""||strings.TrimSpace(x.Name)==""{c.JSON(400,gin.H{"error":"company_id and name are required"});return};out,err:=h.Repo.CreateDepartment(c,x);if err!=nil{c.JSON(409,gin.H{"error":"department may already exist"});return};h.audit(c,"CREATE","DEPARTMENT",&out.ID,map[string]any{"name":out.Name,"company_id":out.CompanyID});c.JSON(201,out)}
func(h *Handler)UpdateDepartment(c *gin.Context){var x domain.Department;if err:=c.ShouldBindJSON(&x);err!=nil{c.JSON(400,gin.H{"error":"invalid payload"});return};if strings.TrimSpace(x.Name)==""{c.JSON(400,gin.H{"error":"name is required"});return};id:=c.Param("id");out,err:=h.Repo.UpdateDepartment(c,id,x);if err!=nil{c.JSON(409,gin.H{"error":"department may already exist or not found"});return};h.audit(c,"UPDATE","DEPARTMENT",&id,map[string]any{"name":out.Name});c.JSON(200,out)}
func(h *Handler)DeleteDepartment(c *gin.Context){id:=c.Param("id");if err:=h.Repo.DeleteDepartment(c,id);err!=nil{c.JSON(409,gin.H{"error":err.Error()});return};h.audit(c,"DELETE","DEPARTMENT",&id,nil);c.Status(204)}

func(h *Handler)ListUsers(c *gin.Context){items,err:=h.Repo.ListUsers(c,c.Query("q"),c.Query("status"),c.Query("company_id"),c.Query("department_id"));if err!=nil{c.JSON(500,gin.H{"error":err.Error()});return};c.JSON(200,gin.H{"data":items})}
func(h *Handler)CreateUser(c *gin.Context){var req struct{domain.User;Password string `json:"password"`};if err:=c.ShouldBindJSON(&req);err!=nil{c.JSON(400,gin.H{"error":"invalid payload"});return};if req.Password==""{c.JSON(400,gin.H{"error":"password is required for a new employee"});return};if strings.TrimSpace(req.EmployeeCode)==""||strings.TrimSpace(req.Username)==""||strings.TrimSpace(req.FullName)==""||strings.TrimSpace(req.CompanyID)==""{c.JSON(400,gin.H{"error":"employee_code, username, full_name and company_id are required"});return};req.Role=strings.ToUpper(strings.TrimSpace(req.Role));if req.Role==""{req.Role="USER"};req.Status="ACTIVE";hash,err:=auth.HashPassword(req.Password);if err!=nil{c.JSON(500,gin.H{"error":"hash failed"});return};u,err:=h.Repo.CreateUser(c,req.User,hash);if err!=nil{c.JSON(409,gin.H{"error":"username or employee code may already exist"});return};h.audit(c,"CREATE","USER",&u.ID,map[string]any{"username":u.Username,"employee_code":u.EmployeeCode});c.JSON(201,u)}
func(h *Handler)UpdateUser(c *gin.Context){var req domain.User;if err:=c.ShouldBindJSON(&req);err!=nil{c.JSON(400,gin.H{"error":"invalid payload"});return};if req.Status==""{req.Status="ACTIVE"};req.Role=strings.ToUpper(strings.TrimSpace(req.Role));if req.Role==""{req.Role="USER"};if strings.TrimSpace(req.EmployeeCode)==""||strings.TrimSpace(req.Username)==""||strings.TrimSpace(req.FullName)==""||strings.TrimSpace(req.CompanyID)==""{c.JSON(400,gin.H{"error":"employee_code, username, full_name and company_id are required"});return};id:=c.Param("id");out,err:=h.Repo.UpdateUser(c,id,req);if err!=nil{c.JSON(409,gin.H{"error":"user update failed, check unique fields and references"});return};h.audit(c,"UPDATE","USER",&id,map[string]any{"username":out.Username});c.JSON(200,out)}
func(h *Handler)DeleteUser(c *gin.Context){id:=c.Param("id");if err:=h.Repo.DeleteUser(c,id);err!=nil{c.JSON(500,gin.H{"error":err.Error()});return};h.audit(c,"DELETE","USER",&id,nil);c.Status(204)}
func(h *Handler)ResignUser(c *gin.Context){var req struct{ReplacementUserID *string `json:"replacement_user_id"`;Note string `json:"note"`};if err:=c.ShouldBindJSON(&req);err!=nil{c.JSON(400,gin.H{"error":"invalid payload"});return};id:=c.Param("id");if req.ReplacementUserID!=nil&&*req.ReplacementUserID==id{c.JSON(400,gin.H{"error":"replacement user cannot be the resigned employee"});return};if err:=h.Repo.MarkResigned(c,id,req.ReplacementUserID,req.Note);err!=nil{c.JSON(409,gin.H{"error":err.Error()});return};h.audit(c,"RESIGN","USER",&id,map[string]any{"replacement_user_id":req.ReplacementUserID,"note":req.Note});c.Status(204)}

func(h *Handler)ListProjects(c *gin.Context){items,err:=h.Repo.ListProjects(c,c.Query("q"),c.Query("company_id"));if err!=nil{c.JSON(500,gin.H{"error":err.Error()});return};c.JSON(200,gin.H{"data":items})}
func(h *Handler)CreateProject(c *gin.Context){var x domain.Project;if err:=c.ShouldBindJSON(&x);err!=nil{c.JSON(400,gin.H{"error":"invalid payload"});return};if strings.TrimSpace(x.CompanyID)==""||strings.TrimSpace(x.Code)==""||strings.TrimSpace(x.Name)==""{c.JSON(400,gin.H{"error":"company_id, code and name are required"});return};x.Status="ACTIVE";p,err:=h.Repo.CreateProject(c,x);if err!=nil{c.JSON(409,gin.H{"error":"project code may already exist in this company"});return};h.audit(c,"CREATE","PROJECT",&p.ID,map[string]any{"name":p.Name});c.JSON(201,p)}
func(h *Handler)UpdateProject(c *gin.Context){var x domain.Project;if err:=c.ShouldBindJSON(&x);err!=nil{c.JSON(400,gin.H{"error":"invalid payload"});return};if strings.TrimSpace(x.CompanyID)==""||strings.TrimSpace(x.Code)==""||strings.TrimSpace(x.Name)==""{c.JSON(400,gin.H{"error":"company_id, code and name are required"});return};if x.Status==""{x.Status="ACTIVE"};id:=c.Param("id");p,err:=h.Repo.UpdateProject(c,id,x);if err!=nil{c.JSON(409,gin.H{"error":"project update failed"});return};h.audit(c,"UPDATE","PROJECT",&id,map[string]any{"name":p.Name});c.JSON(200,p)}
func(h *Handler)DeleteProject(c *gin.Context){id:=c.Param("id");if err:=h.Repo.DeleteProject(c,id);err!=nil{c.JSON(500,gin.H{"error":err.Error()});return};h.audit(c,"DELETE","PROJECT",&id,nil);c.Status(204)}

func(h *Handler)ListPermissions(c *gin.Context){items,err:=h.Repo.ListPermissions(c,c.Query("user_id"),c.Query("project_id"));if err!=nil{c.JSON(500,gin.H{"error":err.Error()});return};c.JSON(200,gin.H{"data":items})}
func(h *Handler)SetPermission(c *gin.Context){var x domain.Permission;if err:=c.ShouldBindJSON(&x);err!=nil{c.JSON(400,gin.H{"error":"invalid payload"});return};x.Level=normalizeLevel(x.Level);if x.UserID==""||x.ProjectID==""{c.JSON(400,gin.H{"error":"user_id and project_id are required"});return};p,err:=h.Repo.UpsertPermission(c,x);if err!=nil{c.JSON(409,gin.H{"error":"permission save failed, check user/project/resource references"});return};h.audit(c,"SET_PERMISSION","PERMISSION",&p.ID,map[string]any{"user_id":p.UserID,"project_id":p.ProjectID,"level":p.Level});c.JSON(200,p)}
func(h *Handler)ListAudit(c *gin.Context){items,err:=h.Repo.ListAudit(c,100);if err!=nil{c.JSON(500,gin.H{"error":err.Error()});return};c.JSON(200,gin.H{"data":items})}
func(h *Handler)Dashboard(c *gin.Context){var users,companies,projects,resigned int;_=h.Repo.DB.QueryRow(c,`SELECT COUNT(*) FROM users WHERE deleted_at IS NULL`).Scan(&users);_=h.Repo.DB.QueryRow(c,`SELECT COUNT(*) FROM companies WHERE deleted_at IS NULL`).Scan(&companies);_=h.Repo.DB.QueryRow(c,`SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL`).Scan(&projects);_=h.Repo.DB.QueryRow(c,`SELECT COUNT(*) FROM users WHERE status='RESIGNED' AND deleted_at IS NULL`).Scan(&resigned);c.JSON(200,gin.H{"users":users,"companies":companies,"projects":projects,"resigned":resigned})}
func(h *Handler)audit(c *gin.Context,action,entity string,id *string,details map[string]any){if v,ok:=c.Get("claims");ok{cl:=v.(*auth.Claims);_=h.Repo.AddAudit(c,cl.UserID,action,entity,id,details)}}
func validateCodeName(code,name string)error{if strings.TrimSpace(code)==""||strings.TrimSpace(name)==""{return fmt.Errorf("code and name are required")};return nil}
func normalizeLevel(level string)string{switch strings.ToUpper(strings.TrimSpace(level)){case "R","READ":return "READ";case "W","WRITE":return "WRITE";case "X","NONE","DENY":return "NONE";default:return "NONE"}}
func _unused(_ http.Handler){ }
