package repository

import (
	"context"

	"github.com/jackc/pgx/v5"
)

// AccountCompany returns the company of a non-deleted user.
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

// UserCompany returns the company of a non-deleted user.
func (r *Repository) UserCompany(ctx context.Context, userID string) (string, error) {
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

// ProjectCompany returns the company of a non-deleted project.
func (r *Repository) ProjectCompany(ctx context.Context, projectID string) (string, error) {
	var companyID string
	err := r.DB.QueryRow(ctx, `
		SELECT company_id
		FROM projects
		WHERE id = $1 AND deleted_at IS NULL`, projectID).Scan(&companyID)
	if err == pgx.ErrNoRows {
		return "", ErrNotFound
	}
	return companyID, err
}
