package repository

import "context"

type tenantCompanyKey struct{}

// WithTenantCompany carries the company scope derived from the authenticated account.
func WithTenantCompany(ctx context.Context, companyID string) context.Context {
	return context.WithValue(ctx, tenantCompanyKey{}, companyID)
}

// TenantCompany returns the server-derived company scope, when one is attached.
func TenantCompany(ctx context.Context) (string, bool) {
	value, ok := ctx.Value(tenantCompanyKey{}).(string)
	return value, ok && value != ""
}
