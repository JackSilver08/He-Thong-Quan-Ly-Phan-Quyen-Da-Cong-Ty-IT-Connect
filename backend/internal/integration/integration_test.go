package integration

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/it-connect/access-management/internal/db"
	"github.com/it-connect/access-management/migrations"
	"github.com/jackc/pgx/v5/pgconn"
)

func requireIntegration(t *testing.T) string {
	t.Helper()
	if os.Getenv("IT_CONNECT_INTEGRATION") != "1" {
		t.Skip("set IT_CONNECT_INTEGRATION=1 to run PostgreSQL integration tests")
	}
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Fatal("DATABASE_URL is required for integration tests")
	}
	return dsn
}

func TestMigrationsAreIdempotent(t *testing.T) {
	dsn := requireIntegration(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.NewPool(ctx, dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool, migrations.FS); err != nil {
		t.Fatalf("first migration: %v", err)
	}
	if err := db.Migrate(ctx, pool, migrations.FS); err != nil {
		t.Fatalf("second migration: %v", err)
	}

	var count int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM schema_migrations").Scan(&count); err != nil {
		t.Fatalf("count migrations: %v", err)
	}
	if count < 3 {
		t.Fatalf("expected at least 3 applied migrations, got %d", count)
	}
}

func TestDatabaseConstraintsAndTenantScopingData(t *testing.T) {
	dsn := requireIntegration(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.NewPool(ctx, dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool, migrations.FS); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	var companyA, companyB string
	if err := pool.QueryRow(ctx, `
		INSERT INTO companies(code, name, description, status)
		VALUES('TEST-A', 'Test Company A', '', 'ACTIVE')
		ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
		RETURNING id`).Scan(&companyA); err != nil {
		t.Fatalf("create company A: %v", err)
	}
	if err := pool.QueryRow(ctx, `
		INSERT INTO companies(code, name, description, status)
		VALUES('TEST-B', 'Test Company B', '', 'ACTIVE')
		ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
		RETURNING id`).Scan(&companyB); err != nil {
		t.Fatalf("create company B: %v", err)
	}

	var depA string
	if err := pool.QueryRow(ctx, `
		INSERT INTO departments(company_id, code, name)
		VALUES($1, 'IT-TEST', 'IT Test')
		ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
		RETURNING id`, companyA).Scan(&depA); err != nil {
		t.Fatalf("create department: %v", err)
	}

	// The same department code is valid in another company. This is an important tenant invariant.
	var depB string
	if err := pool.QueryRow(ctx, `
		INSERT INTO departments(company_id, code, name)
		VALUES($1, 'IT-TEST', 'IT Test')
		ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
		RETURNING id`, companyB).Scan(&depB); err != nil {
		t.Fatalf("same department code across tenants should be allowed: %v", err)
	}
	if depA == depB {
		t.Fatal("department identifiers unexpectedly match across tenants")
	}

	var projectA string
	if err := pool.QueryRow(ctx, `
		INSERT INTO projects(company_id, code, name, status, folder_path)
		VALUES($1, 'ERP-TEST', 'ERP Test', 'ACTIVE', '/tests/erp')
		ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
		RETURNING id`, companyA).Scan(&projectA); err != nil {
		t.Fatalf("create project: %v", err)
	}

	var userA string
	if err := pool.QueryRow(ctx, `
		INSERT INTO users(employee_code, username, full_name, company_id, department_id, role, status, password_hash)
		VALUES('TEST-A-001', 'test-a-user', 'Test User A', $1, $2, 'USER', 'ACTIVE', 'test-hash')
		ON CONFLICT (username) DO UPDATE SET full_name = EXCLUDED.full_name
		RETURNING id`, companyA, depA).Scan(&userA); err != nil {
		t.Fatalf("create user: %v", err)
	}

	// Regression guard: same user/project membership cannot be duplicated.
	if _, err := pool.Exec(ctx, `
		INSERT INTO project_members(project_id, user_id, project_role)
		VALUES($1, $2, 'MEMBER')`, projectA, userA); err != nil {
		t.Fatalf("create project member: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO project_members(project_id, user_id, project_role)
		VALUES($1, $2, 'MEMBER')`, projectA, userA); err == nil {
		t.Fatal("duplicate project membership was accepted")
	}

	var returnedCompany string
	if err := pool.QueryRow(ctx, `SELECT company_id FROM users WHERE id = $1`, userA).Scan(&returnedCompany); err != nil {
		t.Fatal(err)
	}
	if returnedCompany != companyA {
		t.Fatalf("user tenant mismatch: got %s want %s", returnedCompany, companyA)
	}
}

func TestUniqueViolationIsReturnedAsPostgresError(t *testing.T) {
	dsn := requireIntegration(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := db.NewPool(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	_, err = pool.Exec(ctx, `INSERT INTO companies(code, name) VALUES('UNIQUE-TEST', 'Unique Test')`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = pool.Exec(ctx, `INSERT INTO companies(code, name) VALUES('UNIQUE-TEST', 'Unique Test 2')`)
	if err == nil {
		t.Fatal("duplicate company code was accepted")
	}
	if !isPgCode(err, "23505") {
		t.Fatalf("expected PostgreSQL unique violation, got %T: %v", err, err)
	}
}

func isPgCode(err error, code string) bool {
	if pgErr, ok := err.(*pgconn.PgError); ok {
		return pgErr.Code == code
	}
	if wrapper, ok := err.(interface{ Unwrap() error }); ok {
		return isPgCode(wrapper.Unwrap(), code)
	}
	return false
}
