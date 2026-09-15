import { ACTIONS, ENTITIES, LEVELS } from './format';
import type { AuditLog, Company, Department, Project, User } from './types';

export type Lookup = {
  users: Map<string, User>;
  companies: Map<string, Company>;
  projects: Map<string, Project>;
  departments: Map<string, Department>;
};

/** Một đoạn mô tả: chuỗi thường hoặc phần cần in đậm. */
export type Segment = string | { strong: string };

const DETAIL_LABELS: Record<string, string> = {
  username: 'Tên đăng nhập',
  employee_code: 'Mã nhân viên',
  name: 'Tên',
  user_id: 'Nhân viên',
  project_id: 'Dự án',
  company_id: 'Công ty',
  level: 'Mức quyền',
  replacement_user_id: 'Người thay thế',
  note: 'Ghi chú',
};

function text(value: unknown) {
  return typeof value === 'string' && value ? value : undefined;
}

function projectLabel(project?: Project) {
  return project ? `${project.code} · ${project.name}` : undefined;
}

export function actorName(log: AuditLog, lookup: Lookup) {
  if (!log.actor_user_id) return 'Hệ thống';
  return lookup.users.get(log.actor_user_id)?.full_name ?? 'Người dùng đã xoá';
}

export function entityName(log: AuditLog, lookup: Lookup) {
  const id = log.entity_id ?? '';
  const details = log.details ?? {};
  switch (log.entity_type) {
    case 'USER':
      return lookup.users.get(id)?.full_name ?? text(details.username);
    case 'COMPANY':
      return lookup.companies.get(id)?.name ?? text(details.name);
    case 'PROJECT':
      return projectLabel(lookup.projects.get(id)) ?? text(details.name);
    case 'DEPARTMENT':
      return lookup.departments.get(id)?.name ?? text(details.name);
    default:
      return undefined;
  }
}

export function describeAudit(log: AuditLog, lookup: Lookup): Segment[] {
  const details = log.details ?? {};
  switch (log.action) {
    case 'LOGIN':
      return ['Đăng nhập vào hệ thống'];
    case 'RESIGN': {
      const replacement = lookup.users.get(text(details.replacement_user_id) ?? '')?.full_name;
      return [
        'Cho nghỉ việc ',
        { strong: entityName(log, lookup) ?? 'nhân viên' },
        ...(replacement ? [', người thay thế ', { strong: replacement }] : []),
      ];
    }
    case 'SET_PERMISSION': {
      const level = text(details.level) ?? '';
      return [
        'Đặt quyền ',
        { strong: LEVELS[level]?.label ?? level },
        ' cho ',
        { strong: lookup.users.get(text(details.user_id) ?? '')?.full_name ?? 'nhân viên' },
        ' trên dự án ',
        { strong: projectLabel(lookup.projects.get(text(details.project_id) ?? '')) ?? 'đã xoá' },
      ];
    }
    default: {
      const verb = ACTIONS[log.action]?.verb ?? log.action;
      const entity = (ENTITIES[log.entity_type] ?? log.entity_type).toLowerCase();
      const name = entityName(log, lookup);
      return name ? [`${verb} ${entity} `, { strong: name }] : [`${verb} ${entity}`];
    }
  }
}

export function detailRows(log: AuditLog, lookup: Lookup) {
  return Object.entries(log.details ?? {}).map(([key, raw]) => ({
    label: DETAIL_LABELS[key] ?? key,
    value: resolveValue(key, raw, lookup),
  }));
}

function resolveValue(key: string, raw: unknown, lookup: Lookup) {
  if (raw === null || raw === undefined || raw === '') return '—';
  const value = typeof raw === 'string' ? raw : JSON.stringify(raw);
  switch (key) {
    case 'user_id':
    case 'replacement_user_id':
      return lookup.users.get(value)?.full_name ?? value;
    case 'project_id':
      return projectLabel(lookup.projects.get(value)) ?? value;
    case 'company_id':
      return lookup.companies.get(value)?.name ?? value;
    case 'level':
      return LEVELS[value]?.label ?? value;
    default:
      return value;
  }
}
