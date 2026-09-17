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

const CP437_HIGH =
  '\u00C7\u00FC\u00E9\u00E2\u00E4\u00E0\u00E5\u00E7\u00EA\u00EB\u00E8\u00EF\u00EE\u00EC\u00C4\u00C5' +
  '\u00C9\u00E6\u00C6\u00F4\u00F6\u00F2\u00FB\u00F9\u00FF\u00D6\u00DC\u00A2\u00A3\u00A5\u20A7\u0192' +
  '\u00E1\u00ED\u00F3\u00FA\u00F1\u00D1\u00AA\u00BA\u00BF\u2310\u00AC\u00BD\u00BC\u00A1\u00AB\u00BB' +
  '\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255D\u255C\u255B\u2510' +
  '\u2514\u2534\u252C\u251C\u2500\u253C\u255E\u255F\u255A\u2554\u2569\u2566\u2560\u2550\u256C\u2567' +
  '\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256B\u256A\u2518\u250C\u2588\u2584\u258C\u2590\u2580' +
  '\u03B1\u00DF\u0393\u03C0\u03A3\u03C3\u00B5\u03C4\u03A6\u0398\u03A9\u03B4\u221E\u03C6\u03B5\u2229' +
  '\u2261\u00B1\u2265\u2264\u2320\u2321\u00F7\u2248\u00B0\u2219\u00B7\u221A\u207F\u00B2\u25A0\u00A0';

const cp437Map = new Map<string, number>();
for (let i = 0; i < CP437_HIGH.length; i++) {
  cp437Map.set(CP437_HIGH[i], 0x80 + i);
}

/** Tự động sửa lỗi hiển thị tiếng Việt bị giải mã sai mã hoá (CP437 / Mojibake) */
export function fixVietnameseEncoding(str?: string | null): string {
  if (!str) return '';
  if (!/[├╞ß╗║¡░í¥ú─┐╣╜]/.test(str)) return str;

  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '╣') {
      bytes.push(0xbd);
    } else if (cp437Map.has(ch)) {
      bytes.push(cp437Map.get(ch)!);
    } else {
      const code = ch.charCodeAt(0);
      if (code < 128) {
        bytes.push(code);
      } else {
        const encoded = new TextEncoder().encode(ch);
        encoded.forEach((b) => bytes.push(b));
      }
    }
  }

  try {
    const decoded = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    if (!decoded.includes('\ufffd')) {
      return decoded;
    }
  } catch {
    // fallback
  }

  return str
    .replace(/K├[╜╣ù]\s*hiß╗çu/g, 'Ký hiệu')
    .replace(/M├┤\s*tß║ú/g, 'Mô tả')
    .replace(/Quyß╗ün\s*truy\s*cß║¡p/g, 'Quyền truy cập')
    .replace(/D╞░╞íng\s*Nhß║¡t\s*Tr╞░ß╗¥ng/g, 'Dương Nhật Trường')
    .replace(/Trß║ºn\s*Xu├ón\s*├én/g, 'Trần Xuân Ân')
    .replace(/V├╡\s*V─ân\s*Hiß║┐n/g, 'Võ Văn Hiền')
    .replace(/L├¬\s*D╞░ß╗íng/g, 'Lê Dưỡng');
}

