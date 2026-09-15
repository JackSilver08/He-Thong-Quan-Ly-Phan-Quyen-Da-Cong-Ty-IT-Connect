package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/it-connect/access-management/internal/auth"
	"github.com/it-connect/access-management/internal/domain"
	"github.com/it-connect/access-management/internal/repository"
)

type fakeTenantResolver struct {
	companies    map[string]string
	projects     map[string]string
	departments  map[string]string
}

func (f fakeTenantResolver) AccountState(context.Context, string) (string, string, error) {
	return domain.RoleAdmin, domain.StatusActive, nil
}
func (f fakeTenantResolver) AccountCompany(context.Context, string) (string, error) {
	return "company-a", nil
}
func (f fakeTenantResolver) UserCompany(_ context.Context, id string) (string, error) {
	company, ok := f.companies[id]
	if !ok {
		return "", repository.ErrNotFound
	}
	return company, nil
}
func (f fakeTenantResolver) ProjectCompany(_ context.Context, id string) (string, error) {
	company, ok := f.projects[id]
	if !ok {
		return "", repository.ErrNotFound
	}
	return company, nil
}
func (f fakeTenantResolver) DepartmentCompany(_ context.Context, id string) (string, error) {
	company, ok := f.departments[id]
	if !ok {
		return "", repository.ErrNotFound
	}
	return company, nil
}

func TestTenantGuardRejectsCrossCompanyUserMutation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	resolver := fakeTenantResolver{companies: map[string]string{"user-b": "company-b"}}
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("claims", &auth.Claims{UserID: "admin-a", Role: domain.RoleAdmin, CompanyID: "company-a"})
		c.Next()
	})
	r.Use(TenantGuard(resolver))
	r.DELETE("/api/users/:id", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	req := httptest.NewRequest(http.MethodDelete, "/api/users/user-b", nil)
	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", res.Code)
	}
}

func TestTenantGuardForcesUserListToCallerCompany(t *testing.T) {
	gin.SetMode(gin.TestMode)
	resolver := fakeTenantResolver{}
	gotCompany := ""
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("claims", &auth.Claims{UserID: "admin-a", Role: domain.RoleAdmin, CompanyID: "company-a"})
		c.Next()
	})
	r.Use(TenantGuard(resolver))
	r.GET("/api/users", func(c *gin.Context) {
		gotCompany = c.Query("company_id")
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/users?company_id=company-b", nil)
	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)
	if res.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", res.Code)
	}
	if gotCompany != "company-a" {
		t.Fatalf("company scope widened to %q", gotCompany)
	}
}

func TestTenantGuardRejectsCrossCompanyPermissionBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	resolver := fakeTenantResolver{companies: map[string]string{"user-b": "company-b"}, projects: map[string]string{"project-a": "company-a"}}
	hit := false
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("claims", &auth.Claims{UserID: "admin-a", Role: domain.RoleAdmin, CompanyID: "company-a"})
		c.Next()
	})
	r.Use(TenantGuard(resolver))
	r.POST("/api/permissions", func(c *gin.Context) { hit = true; c.Status(http.StatusNoContent) })

	req := httptest.NewRequest(http.MethodPost, "/api/permissions", stringsReader(`{"user_id":"user-b","project_id":"project-a","level":"READ"}`))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden || hit {
		t.Fatalf("expected forbidden before handler, got status=%d handlerHit=%v", res.Code, hit)
	}
}

func TestTenantGuardAllowsSuperAdminAcrossCompanies(t *testing.T) {
	gin.SetMode(gin.TestMode)
	resolver := fakeTenantResolver{companies: map[string]string{"user-b": "company-b"}}
	hit := false
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("claims", &auth.Claims{UserID: "root", Role: domain.RoleSuperAdmin, CompanyID: "company-a"})
		c.Next()
	})
	r.Use(TenantGuard(resolver))
	r.DELETE("/api/users/:id", func(c *gin.Context) { hit = true; c.Status(http.StatusNoContent) })

	req := httptest.NewRequest(http.MethodDelete, "/api/users/user-b", nil)
	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)
	if res.Code != http.StatusNoContent || !hit {
		t.Fatalf("expected super admin access, got status=%d hit=%v", res.Code, hit)
	}
}

func TestTenantGuardMapsResolverErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	resolver := fakeTenantResolver{}
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("claims", &auth.Claims{UserID: "admin-a", Role: domain.RoleAdmin, CompanyID: "company-a"})
		c.Next()
	})
	r.Use(TenantGuard(resolver))
	r.DELETE("/api/projects/:id", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	req := httptest.NewRequest(http.MethodDelete, "/api/projects/missing", nil)
	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)
	if res.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", res.Code)
	}

	_ = errors.New // keep errors available for future resolver error regression cases
}

func stringsReader(value string) *stringsReaderType {
	return &stringsReaderType{value: value}
}

type stringsReaderType struct{ value string }
func (r *stringsReaderType) Read(p []byte) (int, error) {
	if r.value == "" { return 0, io.EOF }
	n := copy(p, r.value)
	r.value = r.value[n:]
	return n, nil
}
func (r *stringsReaderType) Close() error { return nil }
