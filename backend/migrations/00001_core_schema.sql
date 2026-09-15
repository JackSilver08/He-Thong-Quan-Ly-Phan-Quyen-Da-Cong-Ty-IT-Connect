-- +goose Up
-- Core schema. Two kinds of identity are kept apart on purpose:
--   app_users   : people who log into this web app (IT Connect staff, company admins, auditors).
--   employees   : customer staff whose File Server access is managed; they do not log in (MVP).
-- File Server accounts (SNC01, ct.tb, hcns...) are reusable seats handed from one employee to
-- the next, so permissions attach to the account and holders are tracked over time.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        varchar(50)  NOT NULL UNIQUE,
  name        varchar(200) NOT NULL UNIQUE,
  description text         NOT NULL DEFAULT '',
  status      varchar(20)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

-- ---------------------------------------------------------------------------
-- Web app identity + RBAC
-- ---------------------------------------------------------------------------
CREATE TABLE app_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      varchar(120) NOT NULL UNIQUE,
  full_name     varchar(200) NOT NULL,
  email         varchar(200),
  password_hash text         NOT NULL,
  status        varchar(20)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','LOCKED')),
  last_login_at timestamptz,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- company_id NULL means the role applies system-wide (SUPER_ADMIN, IT_ADMIN, AUDITOR).
CREATE TABLE app_user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id uuid        NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role        varchar(40) NOT NULL CHECK (role IN ('SUPER_ADMIN','IT_ADMIN','COMPANY_ADMIN','PROJECT_MANAGER','USER','AUDITOR')),
  company_id  uuid REFERENCES companies(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (app_user_id, role, company_id)
);

-- ---------------------------------------------------------------------------
-- Organisation
-- ---------------------------------------------------------------------------
CREATE TABLE departments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid         NOT NULL REFERENCES companies(id),
  parent_id  uuid REFERENCES departments(id),
  name       varchar(150) NOT NULL,
  created_at timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

-- Spellings seen in legacy data ("Phòng Đấu Thầu", "Quản Lý Dự Án"...) mapped to one department.
CREATE TABLE department_aliases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid         NOT NULL REFERENCES companies(id),
  department_id uuid         NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  alias         varchar(200) NOT NULL,
  UNIQUE (company_id, alias)
);

CREATE TABLE employees (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid         NOT NULL REFERENCES companies(id),
  department_id   uuid REFERENCES departments(id),
  full_name       varchar(200) NOT NULL,
  email           varchar(200),
  phone           varchar(50),
  status          varchar(20)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RESIGNED')),
  joined_at       date,
  resigned_at     date,
  device_type     varchar(20) CHECK (device_type IN ('LAPTOP','PERSONAL_LAPTOP')),
  legacy_username varchar(120),
  notes           text         NOT NULL DEFAULT '',
  source_ref      varchar(120),
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX idx_employees_company_status ON employees(company_id, status);
CREATE INDEX idx_employees_company_email ON employees(company_id, lower(email));

-- ---------------------------------------------------------------------------
-- File Server accounts and their holders
-- ---------------------------------------------------------------------------
-- Passwords are never stored here. password_must_change flags accounts whose credential
-- was exposed (plaintext spreadsheet, handed over without rotation...).
CREATE TABLE fs_accounts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid         NOT NULL REFERENCES companies(id),
  department_id        uuid REFERENCES departments(id),
  username             varchar(120) NOT NULL,
  kind                 varchar(20)  NOT NULL DEFAULT 'PERSONAL' CHECK (kind IN ('PERSONAL','SHARED','DEVICE')),
  display_name         varchar(200) NOT NULL DEFAULT '',
  status               varchar(20)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','LOCKED','DISABLED')),
  password_must_change boolean      NOT NULL DEFAULT false,
  notes                text         NOT NULL DEFAULT '',
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);
CREATE UNIQUE INDEX uq_fs_accounts_company_username ON fs_accounts(company_id, lower(username));

CREATE TABLE account_assignments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fs_account_id       uuid        NOT NULL REFERENCES fs_accounts(id),
  employee_id         uuid        NOT NULL REFERENCES employees(id),
  status              varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ENDED')),
  started_at          date,
  ended_at            date,
  -- Permissions the holder had while using the account; kept for handover review.
  permission_snapshot jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_account_assignments_one_active ON account_assignments(fs_account_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_account_assignments_employee ON account_assignments(employee_id);

-- ---------------------------------------------------------------------------
-- Resources (share -> folder -> subfolder) and projects
-- ---------------------------------------------------------------------------
CREATE TABLE resources (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid         NOT NULL REFERENCES companies(id),
  parent_id           uuid REFERENCES resources(id),
  kind                varchar(20)  NOT NULL CHECK (kind IN ('SHARE','FOLDER')),
  name                varchar(200) NOT NULL,
  path                text         NOT NULL,
  legacy_label        text         NOT NULL DEFAULT '',
  inherit_permissions boolean      NOT NULL DEFAULT true,
  sort_order          integer      NOT NULL DEFAULT 0,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  CHECK ((kind = 'SHARE') = (parent_id IS NULL)),
  UNIQUE (company_id, path)
);
CREATE INDEX idx_resources_parent ON resources(parent_id);

CREATE TABLE projects (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid         NOT NULL REFERENCES companies(id),
  code             varchar(80)  NOT NULL,
  name             varchar(200) NOT NULL,
  status           varchar(20)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','ARCHIVED')),
  root_resource_id uuid REFERENCES resources(id),
  start_date       date,
  end_date         date,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  UNIQUE (company_id, code)
);

CREATE TABLE project_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  employee_id  uuid        NOT NULL REFERENCES employees(id),
  project_role varchar(80) NOT NULL DEFAULT 'MEMBER',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, employee_id)
);

-- ---------------------------------------------------------------------------
-- Imports, permissions, replacements, audit
-- ---------------------------------------------------------------------------
CREATE TABLE import_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid REFERENCES companies(id),
  source_filename varchar(260) NOT NULL,
  source_sha256   char(64)     NOT NULL,
  status          varchar(20)  NOT NULL CHECK (status IN ('PREVIEWED','COMMITTED','FAILED')),
  summary         jsonb        NOT NULL DEFAULT '{}'::jsonb,
  issues          jsonb        NOT NULL DEFAULT '[]'::jsonb,
  created_by      uuid REFERENCES app_users(id),
  created_by_label varchar(120) NOT NULL DEFAULT '',
  created_at      timestamptz  NOT NULL DEFAULT now(),
  committed_at    timestamptz
);

-- Explicit ACL entry. NONE is stored (not deleted) so a denial stays auditable.
-- Effective access: explicit entry on the node, else inherited from the parent while
-- inherit_permissions is true.
CREATE TABLE permissions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fs_account_id        uuid         NOT NULL REFERENCES fs_accounts(id) ON DELETE CASCADE,
  resource_id          uuid         NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  level                varchar(10)  NOT NULL CHECK (level IN ('NONE','READ','WRITE')),
  source               varchar(20)  NOT NULL DEFAULT 'DIRECT' CHECK (source IN ('DIRECT','ROLE','INHERITED')),
  approved_by_label    varchar(120) NOT NULL DEFAULT '',
  implemented_by_label varchar(120) NOT NULL DEFAULT '',
  granted_by           uuid REFERENCES app_users(id),
  import_job_id        uuid REFERENCES import_jobs(id),
  effective_from       timestamptz,
  effective_to         timestamptz,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (fs_account_id, resource_id)
);
CREATE INDEX idx_permissions_resource ON permissions(resource_id);

CREATE TABLE employee_replacements (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid        NOT NULL REFERENCES companies(id),
  resigned_employee_id    uuid        NOT NULL REFERENCES employees(id),
  replacement_employee_id uuid REFERENCES employees(id),
  fs_account_id           uuid REFERENCES fs_accounts(id),
  source                  varchar(20) NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','IMPORT_INFERRED')),
  confirmed               boolean     NOT NULL DEFAULT false,
  confirmed_by            uuid REFERENCES app_users(id),
  handover_note           text        NOT NULL DEFAULT '',
  import_job_id           uuid REFERENCES import_jobs(id),
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid REFERENCES companies(id),
  actor_user_id uuid REFERENCES app_users(id),
  actor_label   varchar(120) NOT NULL DEFAULT '',
  action        varchar(80)  NOT NULL,
  entity_type   varchar(80)  NOT NULL,
  entity_id     uuid,
  before_data   jsonb,
  after_data    jsonb,
  details       jsonb        NOT NULL DEFAULT '{}'::jsonb,
  ip            varchar(64),
  request_id    varchar(64),
  created_at    timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_company ON audit_logs(company_id, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS employee_replacements;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS import_jobs;
DROP TABLE IF EXISTS project_members;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS resources;
DROP TABLE IF EXISTS account_assignments;
DROP TABLE IF EXISTS fs_accounts;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS department_aliases;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS app_user_roles;
DROP TABLE IF EXISTS app_users;
DROP TABLE IF EXISTS companies;
