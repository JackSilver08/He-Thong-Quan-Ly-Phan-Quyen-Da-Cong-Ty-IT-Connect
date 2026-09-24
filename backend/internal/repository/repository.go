package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/it-connect/access-management/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	DB *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Repository {
	return &Repository{DB: db}
}

// ErrNotFound is returned when the targeted row does not exist or was soft-deleted.
var ErrNotFound = errors.New("not found")

// DepartmentInUseError is returned when deleting a department that still has users.
type DepartmentInUseError struct{ Users int }

func (e *DepartmentInUseError) Error() string {
	return fmt.Sprintf("department has %d active user(s)", e.Users)
}

// IsConflict reports whether err is a unique or foreign-key violation.
func IsConflict(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && (pgErr.Code == "23505" || pgErr.Code == "23503")
}

// IsInvalidInput reports whether PostgreSQL rejected a value, e.g. a malformed UUID or date.
func IsInvalidInput(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && (pgErr.Code == "22P02" || pgErr.Code == "22007" || pgErr.Code == "22008")
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

func requireAffected(tag pgconn.CommandTag, err error) error {
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// AccountState returns the current role and status of a user that has not been deleted.
func (r *Repository) AccountState(ctx context.Context, userID string) (role, status string, err error) {
	err = r.DB.QueryRow(ctx, `
		SELECT role, status FROM users
		WHERE id = $1 AND deleted_at IS NULL`, userID).Scan(&role, &status)
	return role, status, notFound(err)
}

const userColumns = `
		SELECT u.id, u.employee_code, u.username, u.full_name,
			COALESCE(u.email, ''), COALESCE(u.phone, ''),
			u.company_id, u.department_id, d.name, c.name,
			u.role, u.status, u.joined_at, u.resigned_at,
			u.replacement_user_id, COALESCE(u.notes, ''), COALESCE(u.avatar_url, '')
		FROM users u
		JOIN companies c ON c.id = u.company_id
		LEFT JOIN departments d ON d.id = u.department_id`

func scanUser(row pgx.Row) (domain.User, error) {
	var u domain.User
	err := row.Scan(
		&u.ID, &u.EmployeeCode, &u.Username, &u.FullName,
		&u.Email, &u.Phone, &u.CompanyID, &u.DepartmentID,
		&u.DepartmentName, &u.CompanyName, &u.Role, &u.Status,
		&u.JoinedAt, &u.ResignedAt, &u.ReplacementID, &u.Notes, &u.AvatarURL,
	)
	return u, err
}

// FindUser returns a user that has not been deleted.
func (r *Repository) FindUser(ctx context.Context, id string) (domain.User, error) {
	u, err := scanUser(r.DB.QueryRow(ctx, userColumns+` WHERE u.id = $1 AND u.deleted_at IS NULL`, id))
	return u, notFound(err)
}

func (r *Repository) FindLoginUser(ctx context.Context, username string) (string, domain.User, error) {
	var hash string
	var u domain.User
	err := r.DB.QueryRow(ctx, `
		SELECT u.id, u.employee_code, u.username, u.full_name,
			COALESCE(u.email, ''), COALESCE(u.phone, ''),
			u.company_id, u.department_id, d.name, c.name,
			u.role, u.status, u.password_hash, COALESCE(u.notes, ''), COALESCE(u.avatar_url, '')
		FROM users u
		JOIN companies c ON c.id = u.company_id
		LEFT JOIN departments d ON d.id = u.department_id
		WHERE u.username = $1 AND u.deleted_at IS NULL`, username).
		Scan(
			&u.ID, &u.EmployeeCode, &u.Username, &u.FullName,
			&u.Email, &u.Phone, &u.CompanyID, &u.DepartmentID,
			&u.DepartmentName, &u.CompanyName, &u.Role, &u.Status,
			&hash, &u.Notes, &u.AvatarURL,
		)
	return hash, u, err
}

func (r *Repository) EnsureAdmin(ctx context.Context, username, hash string) error {
	var id string
	err := r.DB.QueryRow(ctx, `SELECT id FROM users WHERE username = $1`, username).Scan(&id)
	if err == nil {
		return nil
	}
	if err != pgx.ErrNoRows {
		return err
	}

	var companyID string
	if err := r.DB.QueryRow(ctx, `
		SELECT id FROM companies
		WHERE deleted_at IS NULL
		ORDER BY created_at
		LIMIT 1`,
	).Scan(&companyID); err != nil {
		return fmt.Errorf("find seed company: %w", err)
	}

	_, err = r.DB.Exec(ctx, `
		INSERT INTO users(
			employee_code, username, full_name, email, company_id,
			role, status, password_hash
		) VALUES(
			'ADMIN-001', $1, 'System Administrator',
			'admin@itconnect.local', $2, 'SUPER_ADMIN', 'ACTIVE', $3
		)`, username, companyID, hash)
	return err
}

func (r *Repository) ListCompanies(ctx context.Context, q string) ([]domain.Company, error) {
	query := `
		SELECT id, code, name, description, status, created_at
		FROM companies
		WHERE deleted_at IS NULL`
	args := []any{}

	if value := strings.TrimSpace(q); value != "" {
		query += ` AND (name ILIKE $1 OR code ILIKE $1)`
		args = append(args, "%"+value+"%")
	}
	query += ` ORDER BY name`

	rows, err := r.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []domain.Company{}
	for rows.Next() {
		var c domain.Company
		if err := rows.Scan(&c.ID, &c.Code, &c.Name, &c.Description, &c.Status, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *Repository) CreateCompany(ctx context.Context, c domain.Company) (domain.Company, error) {
	c.Code = strings.TrimSpace(c.Code)
	c.Name = strings.TrimSpace(c.Name)
	err := r.DB.QueryRow(ctx, `
		INSERT INTO companies(code, name, description, status)
		VALUES($1, $2, $3, $4)
		RETURNING id, created_at`,
		c.Code, c.Name, c.Description, c.Status,
	).Scan(&c.ID, &c.CreatedAt)
	return c, err
}

func (r *Repository) UpdateCompany(ctx context.Context, id string, c domain.Company) (domain.Company, error) {
	c.Code = strings.TrimSpace(c.Code)
	c.Name = strings.TrimSpace(c.Name)
	err := r.DB.QueryRow(ctx, `
		UPDATE companies
		SET code = $2, name = $3, description = $4,
			status = COALESCE(NULLIF($5, ''), status), updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
		RETURNING id, code, name, description, status, created_at`,
		id, c.Code, c.Name, c.Description, c.Status,
	).Scan(&c.ID, &c.Code, &c.Name, &c.Description, &c.Status, &c.CreatedAt)
	return c, notFound(err)
}

func (r *Repository) DeleteCompany(ctx context.Context, id string) error {
	return requireAffected(r.DB.Exec(ctx, `
		UPDATE companies
		SET deleted_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL`, id))
}

func (r *Repository) ListDepartments(ctx context.Context, companyID, q string) ([]domain.Department, error) {
	query := `
		SELECT d.id, d.company_id, d.name
		FROM departments d
		JOIN companies c ON c.id = d.company_id
		WHERE c.deleted_at IS NULL`
	args := []any{}
	n := 1

	if value := strings.TrimSpace(companyID); value != "" {
		query += fmt.Sprintf(` AND d.company_id = $%d`, n)
		args = append(args, value)
		n++
	}
	if value := strings.TrimSpace(q); value != "" {
		query += fmt.Sprintf(` AND d.name ILIKE $%d`, n)
		args = append(args, "%"+value+"%")
		n++
	}
	query += ` ORDER BY d.name`

	rows, err := r.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []domain.Department{}
	for rows.Next() {
		var d domain.Department
		if err := rows.Scan(&d.ID, &d.CompanyID, &d.Name); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *Repository) CreateDepartment(ctx context.Context, d domain.Department) (domain.Department, error) {
	d.Name = strings.TrimSpace(d.Name)
	err := r.DB.QueryRow(ctx, `
		INSERT INTO departments(company_id, name)
		VALUES($1, $2)
		RETURNING id`, d.CompanyID, d.Name).Scan(&d.ID)
	return d, err
}

func (r *Repository) UpdateDepartment(ctx context.Context, id string, d domain.Department) (domain.Department, error) {
	d.Name = strings.TrimSpace(d.Name)
	err := r.DB.QueryRow(ctx, `
		UPDATE departments
		SET name = $2
		WHERE id = $1
		RETURNING id, company_id, name`, id, d.Name).
		Scan(&d.ID, &d.CompanyID, &d.Name)
	return d, notFound(err)
}

// DepartmentCompany returns the company a department belongs to.
func (r *Repository) DepartmentCompany(ctx context.Context, id string) (string, error) {
	var companyID string
	err := r.DB.QueryRow(ctx, `SELECT company_id FROM departments WHERE id = $1`, id).Scan(&companyID)
	return companyID, notFound(err)
}

func (r *Repository) DeleteDepartment(ctx context.Context, id string) error {
	var users int
	if err := r.DB.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM users
		WHERE department_id = $1 AND deleted_at IS NULL`, id).Scan(&users); err != nil {
		return err
	}
	if users > 0 {
		return &DepartmentInUseError{Users: users}
	}
	return requireAffected(r.DB.Exec(ctx, `DELETE FROM departments WHERE id = $1`, id))
}

func (r *Repository) ListUsers(ctx context.Context, q, status, companyID, departmentID string) ([]domain.User, error) {
	query := userColumns + `
		WHERE u.deleted_at IS NULL`
	args := []any{}
	n := 1

	if value := strings.TrimSpace(q); value != "" {
		query += fmt.Sprintf(`
			AND (
				u.full_name ILIKE $%d OR
				u.username ILIKE $%d OR
				u.employee_code ILIKE $%d OR
				COALESCE(u.email, '') ILIKE $%d
			)`, n, n, n, n)
		args = append(args, "%"+value+"%")
		n++
	}
	if value := strings.TrimSpace(status); value != "" {
		query += fmt.Sprintf(` AND u.status = $%d`, n)
		args = append(args, strings.ToUpper(value))
		n++
	}
	if value := strings.TrimSpace(companyID); value != "" {
		query += fmt.Sprintf(` AND u.company_id = $%d`, n)
		args = append(args, value)
		n++
	}
	if value := strings.TrimSpace(departmentID); value != "" {
		query += fmt.Sprintf(` AND u.department_id = $%d`, n)
		args = append(args, value)
		n++
	}
	query += ` ORDER BY u.full_name`

	rows, err := r.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []domain.User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (r *Repository) CreateUser(ctx context.Context, u domain.User, hash string) (domain.User, error) {
	u.EmployeeCode = strings.TrimSpace(u.EmployeeCode)
	u.Username = strings.TrimSpace(u.Username)
	u.FullName = strings.TrimSpace(u.FullName)

	err := r.DB.QueryRow(ctx, `
		INSERT INTO users(
			employee_code, username, full_name, email, phone,
			company_id, department_id, role, status, password_hash,
			joined_at, notes
		) VALUES(
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			COALESCE($11::date, CURRENT_DATE), $12
		)
		RETURNING id, joined_at`,
		u.EmployeeCode, u.Username, u.FullName, u.Email, u.Phone,
		u.CompanyID, u.DepartmentID, u.Role, u.Status, hash,
		u.JoinedAt, u.Notes,
	).Scan(&u.ID, &u.JoinedAt)
	return u, err
}

func (r *Repository) UpdateUser(ctx context.Context, id string, u domain.User) (domain.User, error) {
	u.EmployeeCode = strings.TrimSpace(u.EmployeeCode)
	u.Username = strings.TrimSpace(u.Username)
	u.FullName = strings.TrimSpace(u.FullName)

	err := r.DB.QueryRow(ctx, `
		UPDATE users
		SET employee_code = $2,
			username = $3,
			full_name = $4,
			email = $5,
			phone = $6,
			company_id = $7,
			department_id = $8,
			role = $9,
			status = $10,
			joined_at = COALESCE($11::date, joined_at),
			notes = $12,
			updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
		RETURNING id, employee_code, username, full_name,
			COALESCE(email, ''), COALESCE(phone, ''),
			company_id, department_id, role, status, joined_at, notes`,
		id, u.EmployeeCode, u.Username, u.FullName, u.Email, u.Phone,
		u.CompanyID, u.DepartmentID, u.Role, u.Status, u.JoinedAt, u.Notes,
	).Scan(
		&u.ID, &u.EmployeeCode, &u.Username, &u.FullName,
		&u.Email, &u.Phone, &u.CompanyID, &u.DepartmentID,
		&u.Role, &u.Status, &u.JoinedAt, &u.Notes,
	)
	return u, notFound(err)
}

func (r *Repository) UpdateProfile(ctx context.Context, id, fullName, email, phone, avatarURL string) (domain.User, error) {
	var u domain.User
	var err error
	err = r.DB.QueryRow(ctx, `
		UPDATE users
		SET full_name = $2, email = NULLIF($3, ''), phone = NULLIF($4, ''), avatar_url = $5, updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
		RETURNING id, employee_code, username, full_name, COALESCE(email, ''), COALESCE(phone, ''),
			company_id, department_id, role, status, joined_at, resigned_at, replacement_user_id, COALESCE(notes, ''), COALESCE(avatar_url, '')`,
		id, strings.TrimSpace(fullName), strings.TrimSpace(email), strings.TrimSpace(phone), avatarURL,
	).Scan(
		&u.ID, &u.EmployeeCode, &u.Username, &u.FullName, &u.Email, &u.Phone,
		&u.CompanyID, &u.DepartmentID, &u.Role, &u.Status, &u.JoinedAt, &u.ResignedAt,
		&u.ReplacementID, &u.Notes, &u.AvatarURL,
	)
	if err != nil { return u, notFound(err) }
	return u, nil
}

// DeleteUser soft-deletes a user. Callers are responsible for protecting built-in accounts.
func (r *Repository) DeleteUser(ctx context.Context, id string) error {
	return requireAffected(r.DB.Exec(ctx, `
		UPDATE users
		SET deleted_at = NOW(), status = 'DISABLED', updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL`, id))
}

// MarkResigned resigns an active user; it returns ErrNotFound when the user is missing or no longer active.
func (r *Repository) MarkResigned(ctx context.Context, id string, replacementID *string, note string) error {
	return requireAffected(r.DB.Exec(ctx, `
		UPDATE users
		SET status = 'RESIGNED',
			resigned_at = CURRENT_DATE,
			replacement_user_id = $2,
			notes = $3,
			updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL AND status = 'ACTIVE'`, id, replacementID, note))
}

func (r *Repository) ListProjects(ctx context.Context, q, companyID string) ([]domain.Project, error) {
	query := `
		SELECT p.id, p.company_id, p.code, p.name, p.status,
			p.folder_path, p.start_date, p.end_date, c.name
		FROM projects p
		JOIN companies c ON c.id = p.company_id
		WHERE p.deleted_at IS NULL`
	args := []any{}
	n := 1

	if value := strings.TrimSpace(q); value != "" {
		query += fmt.Sprintf(` AND (p.name ILIKE $%d OR p.code ILIKE $%d)`, n, n)
		args = append(args, "%"+value+"%")
		n++
	}
	if value := strings.TrimSpace(companyID); value != "" {
		query += fmt.Sprintf(` AND p.company_id = $%d`, n)
		args = append(args, value)
		n++
	}
	query += ` ORDER BY p.name`

	rows, err := r.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []domain.Project{}
	for rows.Next() {
		var p domain.Project
		if err := rows.Scan(
			&p.ID, &p.CompanyID, &p.Code, &p.Name, &p.Status,
			&p.FolderPath, &p.StartDate, &p.EndDate, &p.CompanyName,
		); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Repository) CreateProject(ctx context.Context, p domain.Project) (domain.Project, error) {
	err := r.DB.QueryRow(ctx, `
		INSERT INTO projects(company_id, code, name, status, folder_path, start_date, end_date)
		VALUES($1, $2, $3, $4, $5, $6, $7)
		RETURNING id`,
		p.CompanyID, strings.TrimSpace(p.Code), strings.TrimSpace(p.Name),
		p.Status, p.FolderPath, p.StartDate, p.EndDate,
	).Scan(&p.ID)
	return p, err
}

func (r *Repository) UpdateProject(ctx context.Context, id string, p domain.Project) (domain.Project, error) {
	err := r.DB.QueryRow(ctx, `
		UPDATE projects
		SET company_id = $2,
			code = $3,
			name = $4,
			status = COALESCE(NULLIF($5, ''), status),
			folder_path = $6,
			start_date = $7,
			end_date = $8,
			updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
		RETURNING id, company_id, code, name, status, folder_path, start_date, end_date`,
		id, p.CompanyID, strings.TrimSpace(p.Code), strings.TrimSpace(p.Name),
		p.Status, p.FolderPath, p.StartDate, p.EndDate,
	).Scan(
		&p.ID, &p.CompanyID, &p.Code, &p.Name, &p.Status,
		&p.FolderPath, &p.StartDate, &p.EndDate,
	)
	return p, notFound(err)
}

func (r *Repository) DeleteProject(ctx context.Context, id string) error {
	return requireAffected(r.DB.Exec(ctx, `
		UPDATE projects
		SET deleted_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL`, id))
}

// PermissionTargets returns the status of the (non-deleted) user, or nil when it does not exist,
// and whether the project exists and has not been deleted.
func (r *Repository) PermissionTargets(ctx context.Context, userID, projectID string) (userStatus *string, projectExists bool, err error) {
	err = r.DB.QueryRow(ctx, `
		SELECT
			(SELECT status FROM users WHERE id = $1 AND deleted_at IS NULL),
			EXISTS(SELECT 1 FROM projects WHERE id = $2 AND deleted_at IS NULL)`,
		userID, projectID,
	).Scan(&userStatus, &projectExists)
	return userStatus, projectExists, err
}

func (r *Repository) ListPermissions(ctx context.Context, userID, projectID string) ([]domain.Permission, error) {
	query := `
		SELECT pe.id, pe.user_id, pe.project_id, pe.resource_id, pe.level,
			u.full_name, p.name, r.name
		FROM permissions pe
		JOIN users u ON u.id = pe.user_id
		JOIN projects p ON p.id = pe.project_id
		LEFT JOIN resources r ON r.id = pe.resource_id
		WHERE 1 = 1`
	args := []any{}
	n := 1

	if value := strings.TrimSpace(userID); value != "" {
		query += fmt.Sprintf(` AND pe.user_id = $%d`, n)
		args = append(args, value)
		n++
	}
	if value := strings.TrimSpace(projectID); value != "" {
		query += fmt.Sprintf(` AND pe.project_id = $%d`, n)
		args = append(args, value)
		n++
	}
	query += ` ORDER BY p.name, u.full_name`

	rows, err := r.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []domain.Permission{}
	for rows.Next() {
		var p domain.Permission
		if err := rows.Scan(
			&p.ID, &p.UserID, &p.ProjectID, &p.ResourceID,
			&p.Level, &p.UserName, &p.ProjectName, &p.ResourceName,
		); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// UpsertPermission relies on the NULLS NOT DISTINCT unique constraint (migration 00002), so a
// project-wide permission (resource_id NULL) is updated in place instead of duplicated.
func (r *Repository) UpsertPermission(ctx context.Context, p domain.Permission) (domain.Permission, error) {
	err := r.DB.QueryRow(ctx, `
		INSERT INTO permissions(user_id, project_id, resource_id, level)
		VALUES($1, $2, $3, $4)
		ON CONFLICT(user_id, project_id, resource_id)
		DO UPDATE SET level = EXCLUDED.level, updated_at = NOW()
		RETURNING id`,
		p.UserID, p.ProjectID, p.ResourceID, p.Level,
	).Scan(&p.ID)
	return p, err
}

func (r *Repository) ListAudit(ctx context.Context, limit int) ([]domain.AuditLog, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}

	rows, err := r.DB.Query(ctx, `
		SELECT id, actor_user_id, action, entity_type, entity_id, details, created_at
		FROM audit_logs
		ORDER BY created_at DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []domain.AuditLog{}
	for rows.Next() {
		var a domain.AuditLog
		var raw []byte
		if err := rows.Scan(
			&a.ID, &a.ActorUserID, &a.Action, &a.EntityType,
			&a.EntityID, &raw, &a.CreatedAt,
		); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(raw, &a.Details)
		out = append(out, a)
	}
	return out, rows.Err()
}

func (r *Repository) AddAudit(ctx context.Context, actorID, action, entityType string, entityID *string, details map[string]any) error {
	raw, _ := json.Marshal(details)
	_, err := r.DB.Exec(ctx, `
		INSERT INTO audit_logs(actor_user_id, action, entity_type, entity_id, details)
		VALUES($1, $2, $3, $4, $5)`, actorID, action, entityType, entityID, raw)
	return err
}

// ---------------------------------------------------------------- Resources (Folders)

func (r *Repository) ListProjectResources(ctx context.Context, projectID string) ([]domain.Resource, error) {
	rows, err := r.DB.Query(ctx, `
		SELECT id, project_id, parent_id, name, COALESCE(path, ''), resource_type, created_at
		FROM resources
		WHERE project_id = $1
		ORDER BY path, name`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []domain.Resource{}
	for rows.Next() {
		var res domain.Resource
		if err := rows.Scan(&res.ID, &res.ProjectID, &res.ParentID, &res.Name, &res.Path, &res.ResourceType, &res.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, res)
	}
	return out, rows.Err()
}

func (r *Repository) CreateResource(ctx context.Context, res domain.Resource) (domain.Resource, error) {
	res.Name = strings.TrimSpace(res.Name)
	res.Path = strings.TrimSpace(res.Path)
	if res.ResourceType == "" {
		res.ResourceType = "FOLDER"
	}
	err := r.DB.QueryRow(ctx, `
		INSERT INTO resources(project_id, parent_id, name, path, resource_type)
		VALUES($1, $2, $3, $4, $5)
		RETURNING id, created_at`,
		res.ProjectID, res.ParentID, res.Name, res.Path, res.ResourceType,
	).Scan(&res.ID, &res.CreatedAt)
	return res, err
}

func (r *Repository) DeleteResource(ctx context.Context, resourceID string) error {
	return requireAffected(r.DB.Exec(ctx, `DELETE FROM resources WHERE id = $1`, resourceID))
}

// ---------------------------------------------------------------- Project Members

func (r *Repository) ListProjectMembers(ctx context.Context, projectID string) ([]domain.ProjectMember, error) {
	rows, err := r.DB.Query(ctx, `
		SELECT pm.id, pm.project_id, pm.user_id, pm.project_role, pm.joined_at, pm.left_at,
			u.full_name, u.employee_code, u.username, COALESCE(u.email, ''), u.status
		FROM project_members pm
		JOIN users u ON u.id = pm.user_id
		WHERE pm.project_id = $1 AND u.deleted_at IS NULL
		ORDER BY u.full_name`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []domain.ProjectMember{}
	for rows.Next() {
		var m domain.ProjectMember
		if err := rows.Scan(
			&m.ID, &m.ProjectID, &m.UserID, &m.ProjectRole, &m.JoinedAt, &m.LeftAt,
			&m.FullName, &m.EmployeeCode, &m.Username, &m.Email, &m.Status,
		); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *Repository) AddProjectMember(ctx context.Context, projectID, userID, role string) (domain.ProjectMember, error) {
	role = strings.TrimSpace(role)
	if role == "" {
		role = "MEMBER"
	}
	var m domain.ProjectMember
	m.ProjectID = projectID
	m.UserID = userID
	m.ProjectRole = role
	err := r.DB.QueryRow(ctx, `
		INSERT INTO project_members(project_id, user_id, project_role)
		VALUES($1, $2, $3)
		ON CONFLICT(project_id, user_id)
		DO UPDATE SET project_role = EXCLUDED.project_role, updated_at = NOW()
		RETURNING id, joined_at`,
		projectID, userID, role,
	).Scan(&m.ID, &m.JoinedAt)
	return m, err
}

func (r *Repository) RemoveProjectMember(ctx context.Context, projectID, userID string) error {
	return requireAffected(r.DB.Exec(ctx, `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`, projectID, userID))
}

// ---------------------------------------------------------------- User Portal Access

func (r *Repository) GetUserAccessSummary(ctx context.Context, userID string) (domain.UserAccessSummary, error) {
	var summary domain.UserAccessSummary
	summary.Projects = []domain.MyAccessProject{}
	summary.Resources = []domain.MyAccessResource{}

	projRows, err := r.DB.Query(ctx, `
		SELECT DISTINCT p.id, p.code, p.name, c.name, COALESCE(p.folder_path, ''), pe.level,
			(SELECT COUNT(*) FROM resources res WHERE res.project_id = p.id) AS resource_count
		FROM permissions pe
		JOIN projects p ON p.id = pe.project_id
		JOIN companies c ON c.id = p.company_id
		WHERE pe.user_id = $1 AND pe.resource_id IS NULL AND pe.level != 'NONE' AND p.deleted_at IS NULL
		ORDER BY p.name`, userID)
	if err != nil {
		return summary, err
	}
	defer projRows.Close()

	for projRows.Next() {
		var p domain.MyAccessProject
		if err := projRows.Scan(&p.ProjectID, &p.ProjectCode, &p.ProjectName, &p.CompanyName, &p.FolderPath, &p.Level, &p.ResourceCount); err != nil {
			return summary, err
		}
		summary.Projects = append(summary.Projects, p)
	}

	resRows, err := r.DB.Query(ctx, `
		SELECT res.id, p.id, p.code, p.name, res.name, COALESCE(res.path, ''), pe.level, res.parent_id
		FROM permissions pe
		JOIN resources res ON res.id = pe.resource_id
		JOIN projects p ON p.id = res.project_id
		WHERE pe.user_id = $1 AND pe.level != 'NONE' AND p.deleted_at IS NULL
		ORDER BY p.name, res.path`, userID)
	if err != nil {
		return summary, err
	}
	defer resRows.Close()

	for resRows.Next() {
		var rf domain.MyAccessResource
		if err := resRows.Scan(&rf.ResourceID, &rf.ProjectID, &rf.ProjectCode, &rf.ProjectName, &rf.ResourceName, &rf.Path, &rf.Level, &rf.ParentID); err != nil {
			return summary, err
		}
		summary.Resources = append(summary.Resources, rf)
	}

	return summary, nil
}

