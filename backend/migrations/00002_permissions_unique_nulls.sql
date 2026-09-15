-- Project-wide permissions have resource_id = NULL. The original UNIQUE (user_id, project_id, resource_id)
-- treats NULLs as distinct, so ON CONFLICT never fired and every save inserted another row.
-- This migration is idempotent: it may run both from docker-entrypoint-initdb.d and from the API.

-- Keep only the most recently updated row for each user/project/resource.
DELETE FROM permissions p
USING (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, project_id, resource_id
           ORDER BY updated_at DESC, created_at DESC, id DESC
         ) AS rn
  FROM permissions
) ranked
WHERE p.id = ranked.id
  AND ranked.rn > 1;

ALTER TABLE permissions
  DROP CONSTRAINT IF EXISTS permissions_user_id_project_id_resource_id_key,
  DROP CONSTRAINT IF EXISTS permissions_user_project_resource_key,
  ADD CONSTRAINT permissions_user_project_resource_key
    UNIQUE NULLS NOT DISTINCT (user_id, project_id, resource_id);
