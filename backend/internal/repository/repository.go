package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/it-connect/access-management/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct{ DB *pgxpool.Pool }

func New(db *pgxpool.Pool) *Repository { return &Repository{DB: db} }

func (r *Repository) FindLoginUser(ctx context.Context, username string) (string, domain.User, error) {
	var hash string
	var u domain.User
	err := r.DB.QueryRow(ctx, `SELECT u.id, u.employee_code, u.username, u.full_name, COALESCE(u.email, ''), COALESCE(u.phone, ''), u.company_id, u.department_id, d.name, c.name, u.role, u.status, u.password_hash FROM users u JOIN companies c ON c.id=u.company_id LEFT JOIN departments d ON d.id=u.department_id WHERE u.username=$1 AND u.deleted_at IS NULL`, username).
		Scan(&u.ID, &u.EmployeeCode, &u.Username, &u.FullName, &u.Email, &u.Phone, &u.CompanyID, &u.DepartmentID, &u.DepartmentName, &u.CompanyName, &u.Role, &u.Status, &hash)
	return hash, u, err
}

func (r *Repository) EnsureAdmin(ctx context.Context, username, hash string) error {
	var id string
	err := r.DB.QueryRow(ctx, `SELECT id FROM users WHERE username=$1`, username).Scan(&id)
	if err == nil {
		return nil
	}
	if err != pgx.ErrNoRows {
		return err
	}
	var companyID string
	if err := r.DB.QueryRow(ctx, `SELECT id FROM companies ORDER BY created_at LIMIT 1`).Scan(&companyID); err != nil {
		return fmt.Errorf("find seed company: %w", err)
	}
	_, err = r.DB.Exec(ctx, `INSERT INTO users(employee_code,username,full_name,email,company_id,role,status,password_hash) VALUES('ADMIN-001',$1,'System Administrator','admin@itconnect.local',$2,'SUPER_ADMIN','ACTIVE',$3)`, username, companyID, hash)
	return err
}

func (r *Repository) ListCompanies(ctx context.Context, q string) ([]domain.Company, error) {
	query := `SELECT id, code, name, description, status, created_at FROM companies WHERE deleted_at IS NULL`
	args := []any{}
	if q != "" {
		query += ` AND (name ILIKE $1 OR code ILIKE $1)`
		args = append(args, "%"+q+"%")
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
	err := r.DB.QueryRow(ctx, `INSERT INTO companies(code,name,description,status) VALUES($1,$2,$3,$4) RETURNING id,created_at`, c.Code, c.Name, c.Description, c.Status).Scan(&c.ID, &c.CreatedAt)
	return c, err
}

func (r *Repository) DeleteCompany(ctx context.Context, id string) error {
	_, err := r.DB.Exec(ctx, `UPDATE companies SET deleted_at=NOW() WHERE id=$1`, id)
	return err
}

func (r *Repository) ListUsers(ctx context.Context, q, status, companyID, departmentID string) ([]domain.User, error) {
	query := `SELECT u.id,u.employee_code,u.username,u.full_name,COALESCE(u.email, ''),COALESCE(u.phone, ''),u.company_id,u.department_id,d.name,c.name,u.role,u.status,u.joined_at,u.resigned_at,u.replacement_user_id FROM users u JOIN companies c ON c.id=u.company_id LEFT JOIN departments d ON d.id=u.department_id WHERE u.deleted_at IS NULL`
	args := []any{}
	n := 1
	if q != "" {
		query += fmt.Sprintf(` AND (u.full_name ILIKE $%d OR u.username ILIKE $%d OR u.employee_code ILIKE $%d OR u.email ILIKE $%d)`, n, n, n, n)
		args = append(args, "%"+q+"%")
		n++
	}
	if status != "" {
		query += fmt.Sprintf(` AND u.status=$%d`, n)
		args = append(args, status)
		n++
	}
	if companyID != "" {
		query += fmt.Sprintf(` AND u.company_id=$%d`, n)
		args = append(args, companyID)
		n++
	}
	if departmentID != "" {
		query += fmt.Sprintf(` AND u.department_id=$%d`, n)
		args = append(args, departmentID)
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
		var u domain.User
		if err := rows.Scan(&u.ID, &u.EmployeeCode, &u.Username, &u.FullName, &u.Email, &u.Phone, &u.CompanyID, &u.DepartmentID, &u.DepartmentName, &u.CompanyName, &u.Role, &u.Status, &u.JoinedAt, &u.ResignedAt, &u.ReplacementID); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (r *Repository) CreateUser(ctx context.Context, u domain.User, hash string) (domain.User, error) {
	err := r.DB.QueryRow(ctx, `INSERT INTO users(employee_code,username,full_name,email,phone,company_id,department_id,role,status,password_hash,joined_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11::date,CURRENT_DATE)) RETURNING id,joined_at`, u.EmployeeCode, u.Username, u.FullName, u.Email, u.Phone, u.CompanyID, u.DepartmentID, u.Role, u.Status, hash, u.JoinedAt).Scan(&u.ID, &u.JoinedAt)
	return u, err
}

func (r *Repository) MarkResigned(ctx context.Context, id string, replacementID *string, note string) error {
	_, err := r.DB.Exec(ctx, `UPDATE users SET status='RESIGNED',resigned_at=CURRENT_DATE,replacement_user_id=$2,notes=$3 WHERE id=$1`, id, replacementID, note)
	return err
}

func (r *Repository) ListProjects(ctx context.Context, q, companyID string) ([]domain.Project, error) {
	query := `SELECT p.id,p.company_id,p.code,p.name,p.status,p.folder_path,p.start_date,p.end_date,c.name FROM projects p JOIN companies c ON c.id=p.company_id WHERE p.deleted_at IS NULL`
	args := []any{}
	n := 1
	if q != "" {
		query += fmt.Sprintf(` AND (p.name ILIKE $%d OR p.code ILIKE $%d)`, n, n)
		args = append(args, "%"+q+"%")
		n++
	}
	if companyID != "" {
		query += fmt.Sprintf(` AND p.company_id=$%d`, n)
		args = append(args, companyID)
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
		if err := rows.Scan(&p.ID, &p.CompanyID, &p.Code, &p.Name, &p.Status, &p.FolderPath, &p.StartDate, &p.EndDate, &p.CompanyName); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Repository) CreateProject(ctx context.Context, p domain.Project) (domain.Project, error) {
	err := r.DB.QueryRow(ctx, `INSERT INTO projects(company_id,code,name,status,folder_path,start_date,end_date) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, p.CompanyID, p.Code, p.Name, p.Status, p.FolderPath, p.StartDate, p.EndDate).Scan(&p.ID)
	return p, err
}

func (r *Repository) ListPermissions(ctx context.Context, userID, projectID string) ([]domain.Permission, error) {
	query := `SELECT pe.id,pe.user_id,pe.project_id,pe.resource_id,pe.level,u.full_name,p.name,r.name FROM permissions pe JOIN users u ON u.id=pe.user_id JOIN projects p ON p.id=pe.project_id LEFT JOIN resources r ON r.id=pe.resource_id WHERE 1=1`
	args := []any{}
	n := 1
	if userID != "" {
		query += fmt.Sprintf(` AND pe.user_id=$%d`, n)
		args = append(args, userID)
		n++
	}
	if projectID != "" {
		query += fmt.Sprintf(` AND pe.project_id=$%d`, n)
		args = append(args, projectID)
		n++
	}
	query += ` ORDER BY p.name,u.full_name`
	rows, err := r.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Permission{}
	for rows.Next() {
		var p domain.Permission
		if err := rows.Scan(&p.ID, &p.UserID, &p.ProjectID, &p.ResourceID, &p.Level, &p.UserName, &p.ProjectName, &p.ResourceName); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Repository) UpsertPermission(ctx context.Context, p domain.Permission) (domain.Permission, error) {
	err := r.DB.QueryRow(ctx, `INSERT INTO permissions(user_id,project_id,resource_id,level) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,project_id,resource_id) DO UPDATE SET level=EXCLUDED.level,updated_at=NOW() RETURNING id`, p.UserID, p.ProjectID, p.ResourceID, p.Level).Scan(&p.ID)
	return p, err
}

func (r *Repository) ListAudit(ctx context.Context, limit int) ([]domain.AuditLog, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	rows, err := r.DB.Query(ctx, `SELECT id,actor_user_id,action,entity_type,entity_id,details,created_at FROM audit_logs ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.AuditLog{}
	for rows.Next() {
		var a domain.AuditLog
		var raw []byte
		if err := rows.Scan(&a.ID, &a.ActorUserID, &a.Action, &a.EntityType, &a.EntityID, &raw, &a.CreatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(raw, &a.Details)
		out = append(out, a)
	}
	return out, rows.Err()
}

func (r *Repository) AddAudit(ctx context.Context, actorID, action, entityType string, entityID *string, details map[string]any) error {
	raw, _ := json.Marshal(details)
	_, err := r.DB.Exec(ctx, `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5)`, actorID, action, entityType, entityID, raw)
	return err
}

func normalizePermission(level string) string {
	l := strings.ToUpper(strings.TrimSpace(level))
	switch l {
	case "R", "READ":
		return "READ"
	case "W", "WRITE":
		return "WRITE"
	default:
		return "NONE"
	}
}
