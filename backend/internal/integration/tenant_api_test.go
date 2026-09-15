package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/it-connect/access-management/internal/auth"
	"github.com/it-connect/access-management/internal/config"
	"github.com/it-connect/access-management/internal/db"
	"github.com/it-connect/access-management/internal/domain"
	"github.com/it-connect/access-management/internal/handler"
	"github.com/it-connect/access-management/internal/middleware"
	"github.com/it-connect/access-management/internal/repository"
	"github.com/it-connect/access-management/migrations"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestTenantIsolationThroughHTTPHandlers(t *testing.T) {
	dsn := requireIntegration(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := db.NewPool(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool, migrations.FS); err != nil {
		t.Fatal(err)
	}

	repo := repository.New(pool)
	secret := "tenant-test-secret"
	companyA := createTestCompany(t, ctx, pool, "TENANT-A")
	companyB := createTestCompany(t, ctx, pool, "TENANT-B")
	adminA := createTestUser(t, ctx, pool, companyA, "tenant-admin-a", domain.RoleAdmin)
	userB := createTestUser(t, ctx, pool, companyB, "tenant-user-b", domain.RoleUser)
	projectB := createTestProject(t, ctx, pool, companyB)

	cfg := config.Config{JWTSecret: secret, JWTExpiresHours: 1, AdminUsername: "admin", AdminPassword: "unused"}
	h := handler.New(repo, cfg)
	gin.SetMode(gin.TestMode)
	r := gin.New()
	api := r.Group("/api")
	protected := api.Group("")
	protected.Use(middleware.JWT(secret), middleware.CurrentUser(repo), middleware.TenantGuard(repo))
	protected.GET("/users", h.ListUsers)
	protected.DELETE("/users/:id", h.DeleteUser)
	protected.POST("/permissions", h.SetPermission)

	adminToken, err := auth.IssueToken(secret, adminA, "tenant-admin-a", domain.RoleAdmin, 1)
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/users?company_id="+companyB, nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("tenant user list status = %d, body=%s", res.Code, res.Body.String())
	}
	var payload struct{ Data []domain.User `json:"data"` }
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	for _, user := range payload.Data {
		if user.CompanyID != companyA {
			t.Fatalf("tenant leak: returned user %s from company %s while scoped to %s", user.Username, user.CompanyID, companyA)
		}
	}
	if len(payload.Data) == 0 {
		t.Fatal("expected at least one company-A user in scoped list")
	}

	req = httptest.NewRequest(http.MethodDelete, "/api/users/"+userB, nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	res = httptest.NewRecorder()
	r.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("cross-company delete status = %d, body=%s", res.Code, res.Body.String())
	}

	body := `{"user_id":"` + userB + `","project_id":"` + projectB + `","level":"WRITE"}`
	req = httptest.NewRequest(http.MethodPost, "/api/permissions", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	res = httptest.NewRecorder()
	r.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("cross-company permission status = %d, body=%s", res.Code, res.Body.String())
	}

	rootID := createTestUser(t, ctx, pool, companyA, "tenant-root", domain.RoleSuperAdmin)
	rootToken, err := auth.IssueToken(secret, rootID, "tenant-root", domain.RoleSuperAdmin, 1)
	if err != nil {
		t.Fatal(err)
	}
	req = httptest.NewRequest(http.MethodGet, "/api/users?company_id="+companyB, nil)
	req.Header.Set("Authorization", "Bearer "+rootToken)
	res = httptest.NewRecorder()
	r.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("super admin list status = %d, body=%s", res.Code, res.Body.String())
	}
}

func createTestCompany(t *testing.T, ctx context.Context, pool *pgxpool.Pool, code string) string {
	t.Helper()
	var id string
	if err := pool.QueryRow(ctx, `INSERT INTO companies(code, name, description, status) VALUES($1, $2, '', 'ACTIVE') RETURNING id`, code, code+" Company").Scan(&id); err != nil {
		t.Fatalf("create company %s: %v", code, err)
	}
	return id
}

func createTestUser(t *testing.T, ctx context.Context, pool *pgxpool.Pool, companyID, username, role string) string {
	t.Helper()
	hash, err := auth.HashPassword("test-password")
	if err != nil {
		t.Fatal(err)
	}
	var id string
	if err := pool.QueryRow(ctx, `
		INSERT INTO users(employee_code, username, full_name, company_id, role, status, password_hash)
		VALUES($1, $2, $3, $4, $5, 'ACTIVE', $6)
		RETURNING id`, strings.ToUpper(username)+"-CODE", username, username, companyID, role, hash).Scan(&id); err != nil {
		t.Fatalf("create user %s: %v", username, err)
	}
	return id
}

func createTestProject(t *testing.T, ctx context.Context, pool *pgxpool.Pool, companyID string) string {
	t.Helper()
	var id string
	if err := pool.QueryRow(ctx, `
		INSERT INTO projects(company_id, code, name, status, folder_path)
		VALUES($1, 'TENANT-PROJECT-B', 'Tenant Project B', 'ACTIVE', '/tenant/b')
		RETURNING id`, companyID).Scan(&id); err != nil {
		t.Fatalf("create project: %v", err)
	}
	return id
}
