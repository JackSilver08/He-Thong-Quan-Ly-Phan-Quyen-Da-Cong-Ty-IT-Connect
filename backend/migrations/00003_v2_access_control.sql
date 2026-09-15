-- IT Connect V2 access-control foundation.
-- Idempotent so it can run on an existing database and on a fresh Docker volume.

BEGIN;

-- Department codes help normalize legacy Excel data while preserving the current name-based UI.
ALTER TABLE departments ADD COLUMN IF NOT EXISTS code varchar(50);
UPDATE departments
SET code = 'DEP-' || upper(substr(md5(company_id::text || ':' || name), 1, 12))
WHERE code IS NULL OR btrim(code) = '';
ALTER TABLE departments ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_departments_company_code ON departments(company_id, code);

-- Distinguish human, shared and service identities for legacy/enterprise accounts.
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type varchar(20) NOT NULL DEFAULT 'PERSON';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_account_type_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_account_type_check
      CHECK (account_type IN ('PERSON','SHARED','SERVICE','SYSTEM'));
  END IF;
END $$;

-- Project membership is a first-class access scope in V2.
CREATE TABLE IF NOT EXISTS project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_role varchar(80) NOT NULL DEFAULT 'MEMBER',
  joined_at date NOT NULL DEFAULT CURRENT_DATE,
  left_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- Resources become a real project-owned folder hierarchy.
ALTER TABLE resources ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS parent_id uuid;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS path text;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS resource_type varchar(20) NOT NULL DEFAULT 'FOLDER';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'resources_project_fk'
  ) THEN
    ALTER TABLE resources ADD CONSTRAINT resources_project_fk
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'resources_parent_fk'
  ) THEN
    ALTER TABLE resources ADD CONSTRAINT resources_parent_fk
      FOREIGN KEY(parent_id) REFERENCES resources(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'resources_type_check'
  ) THEN
    ALTER TABLE resources ADD CONSTRAINT resources_type_check
      CHECK (resource_type IN ('ROOT','FOLDER'));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS ux_resources_project_path ON resources(project_id, path) WHERE project_id IS NOT NULL AND path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resources_project ON resources(project_id);
CREATE INDEX IF NOT EXISTS idx_resources_parent ON resources(parent_id);

-- Explicit permission provenance and optional effective dates.
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS source varchar(20) NOT NULL DEFAULT 'DIRECT';
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS effective_from date;
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS effective_to date;
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS granted_by uuid;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'permissions_source_check'
  ) THEN
    ALTER TABLE permissions ADD CONSTRAINT permissions_source_check
      CHECK (source IN ('DIRECT','ROLE','INHERITED'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'permissions_granted_by_fk'
  ) THEN
    ALTER TABLE permissions ADD CONSTRAINT permissions_granted_by_fk
      FOREIGN KEY(granted_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'permissions_effective_dates_check'
  ) THEN
    ALTER TABLE permissions ADD CONSTRAINT permissions_effective_dates_check
      CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource_id);
CREATE INDEX IF NOT EXISTS idx_permissions_effective ON permissions(user_id, effective_from, effective_to);

-- Keep replacement events as immutable history instead of only a pointer on users.
CREATE TABLE IF NOT EXISTS employee_replacements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resigned_user_id uuid NOT NULL REFERENCES users(id),
  replacement_user_id uuid NOT NULL REFERENCES users(id),
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employee_replacements_resigned ON employee_replacements(resigned_user_id);
CREATE INDEX IF NOT EXISTS idx_employee_replacements_replacement ON employee_replacements(replacement_user_id);

-- Audit becomes explainable: before/after, network context and request correlation.
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address inet;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id varchar(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS before_data jsonb;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS after_data jsonb;
CREATE INDEX IF NOT EXISTS idx_audit_request_id ON audit_logs(request_id);

COMMIT;
