export type User = {
  id: string;
  employee_code: string;
  username: string;
  full_name: string;
  email: string;
  phone?: string;
  company_id: string;
  company_name: string;
  department_id?: string | null;
  department_name?: string | null;
  role: string;
  status: string;
  joined_at?: string | null;
  resigned_at?: string | null;
  replacement_user_id?: string | null;
  notes?: string;
};

export type Company = {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: string;
  created_at: string;
};

export type Department = {
  id: string;
  company_id: string;
  name: string;
};

export type Project = {
  id: string;
  company_id: string;
  company_name: string;
  code: string;
  name: string;
  status: string;
  folder_path?: string;
  start_date?: string | null;
  end_date?: string | null;
};

export type Permission = {
  id: string;
  user_id: string;
  project_id: string;
  resource_id?: string | null;
  level: string;
  user_name?: string;
  project_name?: string;
  resource_name?: string | null;
};

export type AuditLog = {
  id: string;
  actor_user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type Resource = {
  id: string;
  project_id: string;
  parent_id?: string | null;
  name: string;
  path: string;
  resource_type: string;
  created_at: string;
};

export type ProjectMember = {
  id: string;
  project_id: string;
  user_id: string;
  project_role: string;
  joined_at?: string | null;
  left_at?: string | null;
  full_name: string;
  employee_code: string;
  username?: string;
  email?: string;
  status: string;
};

export type MyAccessProject = {
  project_id: string;
  project_code: string;
  project_name: string;
  company_name: string;
  folder_path: string;
  level: string;
  resource_count: number;
};

export type MyAccessResource = {
  resource_id: string;
  project_id: string;
  project_code: string;
  project_name: string;
  resource_name: string;
  path: string;
  level: string;
  parent_id?: string | null;
};

export type UserAccessSummary = {
  projects: MyAccessProject[];
  resources: MyAccessResource[];
};

export type ImportUserRow = {
  employee_code: string;
  full_name: string;
  username: string;
  email: string;
  phone: string;
  department_name: string;
  role: string;
  status: string;
  joined_date: string;
  notes: string;
  grants: Record<string, string>;
};

export type ImportPreview = {
  total_users: number;
  users: ImportUserRow[];
  new_departments: string[];
  detected_projects: string[];
  total_grants: number;
  warnings: string[];
  errors: string[];
};

