package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/it-connect/access-management/internal/auth"
	"github.com/it-connect/access-management/internal/domain"
	"github.com/it-connect/access-management/internal/repository"
)

type fakeAccountLookup struct {
	role   string
	status string
	err    error
}

func (f fakeAccountLookup) AccountState(context.Context, string) (string, string, error) {
	return f.role, f.status, f.err
}

func testRouter(handler gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(JWT("test-secret"), CurrentUser(fakeAccountLookup{role: domain.RoleAdmin, status: domain.StatusActive}))
	r.GET("/protected", handler)
	return r
}

func TestJWTRejectsMissingBearerToken(t *testing.T) {
	r := testRouter(func(c *gin.Context) { c.Status(http.StatusOK) })
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", res.Code)
	}
}

func TestRequireRolesAllowsConfiguredRole(t *testing.T) {
	token, err := auth.IssueToken("test-secret", "user-1", "admin", domain.RoleAdmin, 1)
	if err != nil {
		t.Fatal(err)
	}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(JWT("test-secret"))
	r.Use(RequireRoles(domain.RoleAdmin, domain.RoleAuditor))
	r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)
	if res.Code != http.StatusNoContent {
		t.Fatalf("expected 204 for allowed role, got %d", res.Code)
	}
}

func TestRequireRolesDeniesUnconfiguredRole(t *testing.T) {
	token, err := auth.IssueToken("test-secret", "user-1", "user", domain.RoleUser, 1)
	if err != nil {
		t.Fatal(err)
	}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(JWT("test-secret"))
	r.Use(RequireRoles(domain.RoleAdmin, domain.RoleAuditor))
	r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for denied role, got %d", res.Code)
	}
}

func TestCurrentUserRejectsInactiveAccount(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(JWT("test-secret"), CurrentUser(fakeAccountLookup{role: domain.RoleAdmin, status: domain.StatusDisabled}))
	r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	token, err := auth.IssueToken("test-secret", "user-1", "admin", domain.RoleAdmin, 1)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for inactive account, got %d", res.Code)
	}
}

func TestCurrentUserPropagatesRepositoryFailure(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(JWT("test-secret"), CurrentUser(fakeAccountLookup{err: assertErr{}}))
	r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	token, err := auth.IssueToken("test-secret", "user-1", "admin", domain.RoleAdmin, 1)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)
	if res.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for lookup failure, got %d", res.Code)
	}
}

type assertErr struct{}

func (assertErr) Error() string { return "database unavailable" }

var _ = repository.ErrNotFound
var _ = time.Second
