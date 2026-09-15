package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/it-connect/access-management/internal/auth"
	"github.com/it-connect/access-management/internal/domain"
	"github.com/it-connect/access-management/internal/repository"
)

// TenantResolver resolves the company that owns an identity, project or department.
type TenantResolver interface {
	CompanyLookup
	UserCompany(ctx context.Context, userID string) (string, error)
	ProjectCompany(ctx context.Context, projectID string) (string, error)
	DepartmentCompany(ctx context.Context, departmentID string) (string, error)
}

// WithTenantScope attaches the server-derived company id to the request context.
func WithTenantScope(c *gin.Context, companyID string) {
	c.Request = c.Request.WithContext(repository.WithTenantCompany(c.Request.Context(), companyID))
}

// TenantGuard prevents cross-company access. SUPER_ADMIN remains global.
// For scoped list endpoints it forces company_id to the company resolved from the authenticated identity.
func TenantGuard(resolver TenantResolver) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, ok := c.Get("claims")
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing claims"})
			return
		}
		cl := claims.(*auth.Claims)
		if cl.Role == domain.RoleSuperAdmin {
			c.Next()
			return
		}
		if strings.TrimSpace(cl.CompanyID) == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "company scope is required"})
			return
		}
		WithTenantScope(c, cl.CompanyID)

		path := c.FullPath()
		method := c.Request.Method
		if method == http.MethodGet {
			switch path {
			case "/api/users", "/api/projects", "/api/departments":
				q := c.Request.URL.Query()
				q.Set("company_id", cl.CompanyID)
				c.Request.URL.RawQuery = q.Encode()
			case "/api/companies", "/api/dashboard", "/api/audit-logs":
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "endpoint requires super admin scope"})
				return
			case "/api/permissions":
				if !checkPermissionQuery(c, resolver, cl.CompanyID) {
					return
				}
			}
			c.Next()
			return
		}

		if !checkMutationScope(c, resolver, cl.CompanyID, path) {
			return
		}
		c.Next()
	}
}

func checkPermissionQuery(c *gin.Context, resolver TenantResolver, companyID string) bool {
	userID := strings.TrimSpace(c.Query("user_id"))
	projectID := strings.TrimSpace(c.Query("project_id"))
	if userID == "" && projectID == "" {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "filter permissions by a user or project within your company"})
		return false
	}
	if userID != "" {
		if !allowResolved(c, func() (string, error) { return resolver.UserCompany(c, userID) }, companyID) {
			return false
		}
	}
	if projectID != "" {
		if !allowResolved(c, func() (string, error) { return resolver.ProjectCompany(c, projectID) }, companyID) {
			return false
		}
	}
	return true
}

func checkMutationScope(c *gin.Context, resolver TenantResolver, companyID, path string) bool {
	if path == "/api/companies" || strings.HasPrefix(path, "/api/companies/") {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "company administration requires super admin scope"})
		return false
	}

	switch {
	case path == "/api/departments":
		body := readJSONBody(c)
		id := strings.TrimSpace(stringValue(body["company_id"]))
		return id == "" || allowCompany(c, id, companyID)
	case strings.HasPrefix(path, "/api/departments/"):
		return allowResolved(c, func() (string, error) { return resolver.DepartmentCompany(c, c.Param("id")) }, companyID)
	case path == "/api/users":
		body := readJSONBody(c)
		id := strings.TrimSpace(stringValue(body["company_id"]))
		return id == "" || allowCompany(c, id, companyID)
	case strings.HasPrefix(path, "/api/users/"):
		if !allowResolved(c, func() (string, error) { return resolver.UserCompany(c, c.Param("id")) }, companyID) {
			return false
		}
		if strings.HasSuffix(path, "/resign") {
			body := readJSONBody(c)
			replacement := strings.TrimSpace(stringValue(body["replacement_user_id"]))
			if replacement != "" && !allowResolved(c, func() (string, error) { return resolver.UserCompany(c, replacement) }, companyID) {
				return false
			}
		}
		return true
	case path == "/api/projects":
		body := readJSONBody(c)
		id := strings.TrimSpace(stringValue(body["company_id"]))
		return id == "" || allowCompany(c, id, companyID)
	case strings.HasPrefix(path, "/api/projects/"):
		return allowResolved(c, func() (string, error) { return resolver.ProjectCompany(c, c.Param("id")) }, companyID)
	case path == "/api/permissions":
		body := readJSONBody(c)
		userID := strings.TrimSpace(stringValue(body["user_id"]))
		projectID := strings.TrimSpace(stringValue(body["project_id"]))
		if userID != "" && !allowResolved(c, func() (string, error) { return resolver.UserCompany(c, userID) }, companyID) {
			return false
		}
		if projectID != "" && !allowResolved(c, func() (string, error) { return resolver.ProjectCompany(c, projectID) }, companyID) {
			return false
		}
		return true
	default:
		return true
	}
}

func allowResolved(c *gin.Context, resolve func() (string, error), companyID string) bool {
	got, err := resolve()
	if errors.Is(err, repository.ErrNotFound) {
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "resource not found"})
		return false
	}
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "unable to resolve company scope"})
		return false
	}
	return allowCompany(c, got, companyID)
}

func allowCompany(c *gin.Context, target, companyID string) bool {
	if target == companyID {
		return true
	}
	c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "resource belongs to another company"})
	return false
}

func readJSONBody(c *gin.Context) map[string]any {
	if c.Request.Body == nil {
		return map[string]any{}
	}
	raw, err := io.ReadAll(io.LimitReader(c.Request.Body, 1<<20))
	if err != nil {
		c.Request.Body = io.NopCloser(bytes.NewReader(nil))
		return map[string]any{}
	}
	c.Request.Body = io.NopCloser(bytes.NewReader(raw))
	var body map[string]any
	if err := json.Unmarshal(raw, &body); err != nil || body == nil {
		return map[string]any{}
	}
	return body
}

func stringValue(v any) string {
	switch x := v.(type) {
	case string:
		return x
	default:
		return ""
	}
}
