package domain

import "time"

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
	JoinedAt       *time.Time `json:"joined_at,omitempty"`
	ResignedAt     *time.Time `json:"resigned_at,omitempty"`
	ReplacementID  *string    `json:"replacement_user_id,omitempty"`
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
	Name      string `json:"name"`
}

type Project struct {
	ID          string     `json:"id"`
	CompanyID   string     `json:"company_id"`
	Code        string     `json:"code"`
	Name        string     `json:"name"`
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
