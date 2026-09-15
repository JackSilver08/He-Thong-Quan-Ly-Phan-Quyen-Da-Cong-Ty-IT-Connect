-- Canonical SQL source for future sqlc generation.
-- Runtime handlers currently use pgx directly while the schema stabilizes.

-- name: ListCompanies :many
SELECT id, code, name, description, status, created_at
FROM companies
WHERE deleted_at IS NULL
ORDER BY name;

-- name: ListDepartments :many
SELECT id, company_id, code, name
FROM departments
ORDER BY name;

-- name: ListUsers :many
SELECT u.id, u.employee_code, u.username, u.full_name, u.email, u.phone,
       u.company_id, u.department_id, d.name AS department_name,
       c.name AS company_name, u.role, u.status, u.joined_at, u.resigned_at,
       u.replacement_user_id
FROM users u
JOIN companies c ON c.id = u.company_id
LEFT JOIN departments d ON d.id = u.department_id
WHERE u.deleted_at IS NULL
ORDER BY u.full_name;

-- name: ListProjects :many
SELECT p.id, p.company_id, p.code, p.name, p.description, p.status,
       p.folder_path, p.start_date, p.end_date, c.name AS company_name
FROM projects p
JOIN companies c ON c.id = p.company_id
WHERE p.deleted_at IS NULL
ORDER BY p.name;

-- name: ListProjectMembers :many
SELECT pm.id, pm.project_id, pm.user_id, pm.project_role, pm.joined_at, pm.left_at,
       u.full_name, u.employee_code, u.status
FROM project_members pm
JOIN users u ON u.id = pm.user_id
WHERE pm.project_id = $1
ORDER BY u.full_name;

-- name: ListResources :many
SELECT id, project_id, parent_id, name, path, resource_type, created_at
FROM resources
WHERE project_id = $1
ORDER BY path;

-- name: ListPermissions :many
SELECT pe.id, pe.user_id, pe.project_id, pe.resource_id, pe.level,
       u.full_name AS user_name, p.name AS project_name, r.name AS resource_name
FROM permissions pe
JOIN users u ON u.id = pe.user_id
JOIN projects p ON p.id = pe.project_id
LEFT JOIN resources r ON r.id = pe.resource_id
ORDER BY p.name, u.full_name;
