package domain

import "time"

const (
	RoleSuperAdmin = "SUPER_ADMIN"
	RoleAdmin      = "ADMIN"
	RoleAuditor    = "AUDITOR"
	RoleUser       = "USER"
)

const (
	StatusActive   = "ACTIVE"
	StatusResigned = "RESIGNED"
	StatusDisabled = "DISABLED"
)

func ValidRole(role string) bool {
	switch role {
	case RoleSuperAdmin, RoleAdmin, RoleAuditor, RoleUser:
		return true
	}
	return false
}

func ValidUserStatus(status string) bool {
	switch status {
	case StatusActive, StatusResigned, StatusDisabled:
		return true
	}
	return false
}

type User struct {
	ID             string     `json:"id"`
	EmployeeCode   string     `json:"employee_code"`
	Username       string     `json:"username"`
	FullName       string     `json:"full_name"`
	Email          string     `json:"email"`
	Phone          string     `json:"phone,omitempty"`
	CompanyID      string     `json:"company_id"`
	DepartmentID   *string    `json:"department_id,omitempty"`
	DepartmentName *string    `json:"department_name,omitempty"`
	CompanyName    string     `json:"company_name"`
	Role           string     `json:"role"`
	Status         string     `json:"status"`
	AccountType    string     `json:"account_type"`
	JoinedAt       *time.Time `json:"joined_at,omitempty"`
	ResignedAt     *time.Time `json:"resigned_at,omitempty"`
	ReplacementID  *string    `json:"replacement_user_id,omitempty"`
	Notes          string     `json:"notes,omitempty"`
}

type Company struct {
	ID          string    `json:"id"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

type Department struct {
	ID        string `json:"id"`
	CompanyID string `json:"company_id"`
	Code      string `json:"code"`
	Name      string `json:"name"`
}

type Project struct {
	ID          string     `json:"id"`
	CompanyID   string     `json:"company_id"`
	Code        string     `json:"code"`
	Name        string     `json:"name"`
	Description string     `json:"description,omitempty"`
	Status      string     `json:"status"`
	FolderPath  string     `json:"folder_path,omitempty"`
	StartDate   *time.Time `json:"start_date,omitempty"`
	EndDate     *time.Time `json:"end_date,omitempty"`
	CompanyName string     `json:"company_name"`
}

type Permission struct {
	ID           string  `json:"id"`
	UserID       string  `json:"user_id"`
	ProjectID    string  `json:"project_id"`
	ResourceID   *string `json:"resource_id,omitempty"`
	Level        string  `json:"level"`
	Source       string  `json:"source,omitempty"`
	UserName     string  `json:"user_name,omitempty"`
	ProjectName  string  `json:"project_name,omitempty"`
	ResourceName *string `json:"resource_name,omitempty"`
}

type AuditLog struct {
	ID          string         `json:"id"`
	ActorUserID *string        `json:"actor_user_id,omitempty"`
	Action      string         `json:"action"`
	EntityType  string         `json:"entity_type"`
	EntityID    *string        `json:"entity_id,omitempty"`
	Details     map[string]any `json:"details"`
	CreatedAt   time.Time      `json:"created_at"`
}

type Resource struct {
	ID           string    `json:"id"`
	ProjectID    string    `json:"project_id"`
	ParentID     *string   `json:"parent_id,omitempty"`
	Name         string    `json:"name"`
	Path         string    `json:"path"`
	ResourceType string    `json:"resource_type"`
	CreatedAt    time.Time `json:"created_at"`
}

type ProjectMember struct {
	ID           string     `json:"id"`
	ProjectID    string     `json:"project_id"`
	UserID       string     `json:"user_id"`
	ProjectRole  string     `json:"project_role"`
	JoinedAt     *time.Time `json:"joined_at,omitempty"`
	LeftAt       *time.Time `json:"left_at,omitempty"`
	FullName     string     `json:"full_name"`
	EmployeeCode string     `json:"employee_code"`
	Username     string     `json:"username,omitempty"`
	Email        string     `json:"email,omitempty"`
	Status       string     `json:"status"`
}

type MyAccessProject struct {
	ProjectID     string `json:"project_id"`
	ProjectCode   string `json:"project_code"`
	ProjectName   string `json:"project_name"`
	CompanyName   string `json:"company_name"`
	FolderPath    string `json:"folder_path"`
	Level         string `json:"level"`
	ResourceCount int    `json:"resource_count"`
}

type MyAccessResource struct {
	ResourceID   string  `json:"resource_id"`
	ProjectID    string  `json:"project_id"`
	ProjectCode  string  `json:"project_code"`
	ProjectName  string  `json:"project_name"`
	ResourceName string  `json:"resource_name"`
	Path         string  `json:"path"`
	Level        string  `json:"level"`
	ParentID     *string `json:"parent_id,omitempty"`
}

type UserAccessSummary struct {
	Projects  []MyAccessProject  `json:"projects"`
	Resources []MyAccessResource `json:"resources"`
}
