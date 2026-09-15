package repository

import (
	"context"

	"github.com/jackc/pgx/v5"
)

// AccountCompany returns the company of an active/non-deleted user.
// The middleware uses this server-side value for tenant scoping instead of trusting request parameters.
func (r *Repository) AccountCompany(ctx context.Context, userID string) (string, error) {
	var companyID string
	err := r.DB.QueryRow(ctx, `
		SELECT company_id
		FROM users
		WHERE id = $1 AND deleted_at IS NULL`, userID).Scan(&companyID)
	if err == pgx.ErrNoRows {
		return "", ErrNotFound
	}
	return companyID, err
}
