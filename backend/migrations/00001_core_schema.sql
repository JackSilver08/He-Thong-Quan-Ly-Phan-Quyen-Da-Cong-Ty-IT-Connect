-- Init script for IT Connect database
-- This file is run automatically by PostgreSQL on first startup

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        varchar(50)  NOT NULL UNIQUE,
  name        varchar(200) NOT NULL UNIQUE,
  description text         NOT NULL DEFAULT '',
  status      varchar(20)  NOT NULL DEFAULT 'ACTIVE',
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE TABLE IF NOT EXISTS departments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid         NOT NULL REFERENCES companies(id),
  name       varchar(150) NOT NULL,
  created_at timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code        varchar(50)  NOT NULL DEFAULT '',
  username             varchar(120) NOT NULL UNIQUE,
  full_name            varchar(200) NOT NULL,
  email                varchar(200),
  phone                varchar(50),
  company_id           uuid         NOT NULL REFERENCES companies(id),
  department_id        uuid REFERENCES departments(id),
  role                 varchar(40)  NOT NULL DEFAULT 'USER',
  status               varchar(20)  NOT NULL DEFAULT 'ACTIVE',
  password_hash        text         NOT NULL,
  joined_at            date         DEFAULT CURRENT_DATE,
  resigned_at          date,
  replacement_user_id  uuid,
  notes                text         NOT NULL DEFAULT '',
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

CREATE TABLE IF NOT EXISTS projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid         NOT NULL REFERENCES companies(id),
  code        varchar(80)  NOT NULL,
  name        varchar(200) NOT NULL,
  status      varchar(20)  NOT NULL DEFAULT 'ACTIVE',
  folder_path text         NOT NULL DEFAULT '',
  start_date  date,
  end_date    date,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS resources (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       varchar(200) NOT NULL,
  created_at timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  resource_id uuid REFERENCES resources(id),
  level       varchar(10) NOT NULL DEFAULT 'NONE',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id, resource_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action        varchar(80)  NOT NULL,
  entity_type   varchar(80)  NOT NULL,
  entity_id     uuid,
  details       jsonb        NOT NULL DEFAULT '{}',
  created_at    timestamptz  NOT NULL DEFAULT now()
);

-- Seed default company so EnsureAdmin can find it
INSERT INTO companies(code, name, description, status)
VALUES('DEFAULT', 'IT Connect', 'Default company', 'ACTIVE')
ON CONFLICT DO NOTHING;
