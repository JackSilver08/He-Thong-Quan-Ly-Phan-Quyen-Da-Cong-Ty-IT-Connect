export type Tone = 'blue' | 'sky' | 'green' | 'red' | 'amber' | 'gray' | 'dark';
export type Label = { label: string; tone: Tone };

export const ROLES: Record<string, Label> = {
  SUPER_ADMIN: { label: 'Quản trị cấp cao', tone: 'dark' },
  ADMIN: { label: 'Quản trị viên', tone: 'blue' },
  AUDITOR: { label: 'Kiểm soát viên', tone: 'amber' },
  USER: { label: 'Người dùng', tone: 'gray' },
};
export const ROLE_ORDER = ['USER', 'ADMIN', 'AUDITOR', 'SUPER_ADMIN'];

export const USER_STATUS: Record<string, Label> = {
  ACTIVE: { label: 'Đang làm việc', tone: 'green' },
  RESIGNED: { label: 'Đã nghỉ việc', tone: 'red' },
  DISABLED: { label: 'Vô hiệu hoá', tone: 'gray' },
};

export const RECORD_STATUS: Record<string, Label> = {
  ACTIVE: { label: 'Hoạt động', tone: 'green' },
  INACTIVE: { label: 'Ngừng hoạt động', tone: 'gray' },
  CLOSED: { label: 'Đã đóng', tone: 'gray' },
};

export const LEVELS: Record<string, Label & { short: string; description: string }> = {
  NONE: { label: 'Không truy cập', short: 'X', tone: 'gray', description: 'Chặn hoàn toàn quyền vào dự án' },
  READ: { label: 'Chỉ xem', short: 'R', tone: 'sky', description: 'Xem và tải tài liệu, không được chỉnh sửa' },
  WRITE: { label: 'Chỉnh sửa', short: 'W', tone: 'blue', description: 'Xem, tạo mới và chỉnh sửa tài liệu' },
  X: { label: 'Không truy cập', short: 'X', tone: 'gray', description: 'Chặn hoàn toàn quyền vào dự án' },
  R: { label: 'Chỉ xem', short: 'R', tone: 'sky', description: 'Xem và tải tài liệu, không được chỉnh sửa' },
  W: { label: 'Chỉnh sửa', short: 'W', tone: 'blue', description: 'Xem, tạo mới và chỉnh sửa tài liệu' },
};
export const LEVEL_ORDER = ['NONE', 'READ', 'WRITE'];

export const ACTIONS: Record<string, Label & { verb: string }> = {
  LOGIN: { label: 'Đăng nhập', verb: 'Đăng nhập', tone: 'gray' },
  CREATE: { label: 'Tạo mới', verb: 'Tạo', tone: 'green' },
  UPDATE: { label: 'Cập nhật', verb: 'Cập nhật', tone: 'blue' },
  DELETE: { label: 'Xoá', verb: 'Xoá', tone: 'red' },
  RESIGN: { label: 'Nghỉ việc', verb: 'Cho nghỉ việc', tone: 'amber' },
  SET_PERMISSION: { label: 'Phân quyền', verb: 'Đặt quyền', tone: 'sky' },
};

export const ENTITIES: Record<string, string> = {
  USER: 'Nhân viên',
  COMPANY: 'Công ty',
  DEPARTMENT: 'Phòng ban',
  PROJECT: 'Dự án',
  PERMISSION: 'Quyền truy cập',
};

export function labelOf(map: Record<string, Label>, key: string): Label {
  return map[key] ?? { label: key, tone: 'gray' };
}

export function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · ${formatDate(value)}`;
}

export function timeAgo(value: string) {
  const seconds = (Date.now() - new Date(value).getTime()) / 1000;
  if (seconds < 60) return 'Vừa xong';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)} ngày trước`;
  return formatDate(value);
}

// Tìm kiếm không phân biệt hoa thường và dấu tiếng Việt ("nguyen" khớp "Nguyễn").
export function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
}

export function matches(query: string, ...fields: Array<string | null | undefined>) {
  const q = normalize(query);
  return !q || fields.some((field) => field && normalize(field).includes(q));
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function byId<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item]));
}

export function readQuery(name: string) {
  return typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(name);
}

export function clearQuery() {
  if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
}
