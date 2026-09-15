package middleware

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/it-connect/access-management/internal/auth"
	"github.com/it-connect/access-management/internal/domain"
	"github.com/it-connect/access-management/internal/repository"
)

func JWT(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}
		claims, err := auth.ParseToken(secret, strings.TrimPrefix(h, "Bearer "))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		c.Set("claims", claims)
		c.Next()
	}
}

// AccountLookup returns the current role and status of a user, or repository.ErrNotFound.
type AccountLookup interface {
	AccountState(ctx context.Context, userID string) (role, status string, err error)
}

// CurrentUser reloads the caller's role and status on every request (after JWT), so a role change,
// resignation or deletion takes effect immediately instead of when the token expires.
func CurrentUser(accounts AccountLookup) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims := c.MustGet("claims").(*auth.Claims)
		role, status, err := accounts.AccountState(c, claims.UserID)
		if errors.Is(err, repository.ErrNotFound) || (err == nil && status != domain.StatusActive) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "account is no longer active"})
			return
		}
		if err != nil {
			slog.Error("load account state", "user_id", claims.UserID, "error", err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
		claims.Role = role
		c.Next()
	}
}

func RequireRoles(roles ...string) gin.HandlerFunc {
	allowed := map[string]bool{}
	for _, r := range roles {
		allowed[r] = true
	}
	return func(c *gin.Context) {
		v, ok := c.Get("claims")
		if !ok {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		cl := v.(*auth.Claims)
		if !allowed[cl.Role] {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient role"})
			return
		}
		c.Next()
	}
}
