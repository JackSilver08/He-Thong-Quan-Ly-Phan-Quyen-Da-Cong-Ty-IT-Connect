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
