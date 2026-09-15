package db

import (
	"context"
	"fmt"
	"io/fs"
	"log/slog"
	"sort"

	"github.com/jackc/pgx/v5/pgxpool"
)

// migrationLockID serializes migrations when several API instances start at the same time.
const migrationLockID int64 = 7_274_2601

// Migrate applies the embedded *.sql migrations in lexical order and records each one in
// schema_migrations.
//
// PostgreSQL's docker-entrypoint-initdb.d also executes every migration on a brand-new volume,
// without recording anything. The first migration seeds data, so on a database that already has
// the core tables but no schema_migrations table it is recorded instead of replayed; later
// migrations must be idempotent and simply run again.
func Migrate(ctx context.Context, pool *pgxpool.Pool, files fs.FS) error {
	names, err := fs.Glob(files, "*.sql")
	if err != nil {
		return fmt.Errorf("list migrations: %w", err)
	}
	sort.Strings(names)

	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire connection: %w", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock($1)`, migrationLockID); err != nil {
		return fmt.Errorf("lock migrations: %w", err)
	}
	defer conn.Exec(context.Background(), `SELECT pg_advisory_unlock($1)`, migrationLockID)

	var tracked, initialized bool
	if err := conn.QueryRow(ctx, `
		SELECT to_regclass('public.schema_migrations') IS NOT NULL,
		       to_regclass('public.users') IS NOT NULL`,
	).Scan(&tracked, &initialized); err != nil {
		return fmt.Errorf("inspect schema: %w", err)
	}
	if _, err := conn.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    text PRIMARY KEY,
			applied_at timestamptz NOT NULL DEFAULT now()
		)`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}
	if !tracked && initialized && len(names) > 0 {
		if _, err := conn.Exec(ctx, `INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING`, names[0]); err != nil {
			return fmt.Errorf("record baseline %s: %w", names[0], err)
		}
		slog.Info("migration baseline recorded", "version", names[0])
	}

	for _, name := range names {
		var applied bool
		if err := conn.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)`, name).Scan(&applied); err != nil {
			return fmt.Errorf("check migration %s: %w", name, err)
		}
		if applied {
			continue
		}
		body, err := fs.ReadFile(files, name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}
		tx, err := conn.Begin(ctx)
		if err != nil {
			return fmt.Errorf("begin migration %s: %w", name, err)
		}
		// Without arguments pgx uses the simple protocol, so a file may contain several statements.
		if _, err := tx.Exec(ctx, string(body)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("apply migration %s: %w", name, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations(version) VALUES($1)`, name); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("record migration %s: %w", name, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit migration %s: %w", name, err)
		}
		slog.Info("migration applied", "version", name)
	}
	return nil
}
