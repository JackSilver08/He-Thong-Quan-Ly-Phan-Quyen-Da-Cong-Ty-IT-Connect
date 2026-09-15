import { api } from './api';
import type { Permission } from './types';

export type PermissionEntry = {
  key: string;
  user_id: string;
  project_id: string;
  resource_id: string | null;
  resource_name: string | null;
  /** Tên lấy kèm từ API, dùng khi nhân viên/dự án đã bị xoá mềm. */
  user_name: string;
  project_name: string;
  /** Mức cao nhất trong các bản ghi (dùng khi đánh giá rủi ro). */
  level: string;
  levels: string[];
  /** Nhiều bản ghi cho cùng nhân viên–dự án–phạm vi nhưng khác mức quyền. */
  conflict: boolean;
};

const RANK: Record<string, number> = { NONE: 0, READ: 1, WRITE: 2 };

// UNIQUE(user_id, project_id, resource_id) không chặn trùng khi resource_id là NULL,
// nên API có thể trả nhiều bản ghi cho cùng một cặp. Gom lại để hiển thị và phát hiện xung đột.
export function groupPermissions(list: Permission[]): PermissionEntry[] {
  const map = new Map<string, PermissionEntry>();
  for (const p of list) {
    const key = entryKey(p.user_id, p.project_id, p.resource_id);
    const entry = map.get(key);
    if (!entry) {
      map.set(key, {
        key,
        user_id: p.user_id,
        project_id: p.project_id,
        resource_id: p.resource_id ?? null,
        resource_name: p.resource_name ?? null,
        user_name: p.user_name ?? '',
        project_name: p.project_name ?? '',
        level: p.level,
        levels: [p.level],
        conflict: false,
      });
      continue;
    }
    if (!entry.levels.includes(p.level)) entry.levels.push(p.level);
    entry.conflict = entry.levels.length > 1;
    if ((RANK[p.level] ?? 0) > (RANK[entry.level] ?? 0)) entry.level = p.level;
  }
  return [...map.values()];
}

export function entryKey(userId: string, projectId: string, resourceId?: string | null) {
  return `${userId}|${projectId}|${resourceId ?? ''}`;
}

export function hasAccess(entry: PermissionEntry) {
  return entry.levels.some((level) => level !== 'NONE');
}

/** Đặt mức NONE cho từng quyền; trả về số lượng thành công/thất bại. */
export async function revokeEntries(entries: PermissionEntry[]) {
  const results = await Promise.allSettled(
    entries.map((entry) =>
      api('/permissions', {
        method: 'POST',
        body: JSON.stringify({ user_id: entry.user_id, project_id: entry.project_id, resource_id: entry.resource_id, level: 'NONE' }),
      }),
    ),
  );
  const failed = results.filter((result) => result.status === 'rejected').length;
  return { done: results.length - failed, failed };
}
