-- Canonical SQL source for future sqlc generation.
-- The MVP repository uses pgx directly while the schema stabilizes.

-- name: ListUsers :many
SELECT u.id, u.employee_code, u.username, u.full_name, u.email,
       u.company_id, u.department_id, u.role, u.status
FROM users u
WHERE u.deleted_at IS NULL
ORDER BY u.full_name;
