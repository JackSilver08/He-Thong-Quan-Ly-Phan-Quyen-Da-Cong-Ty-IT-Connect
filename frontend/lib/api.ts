const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
const TOKEN_KEY = 'itc_token';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API}${path}`, { ...init, headers, cache: 'no-store' });
  if (!res.ok) {
    let message = 'Request failed';
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {}
    if (res.status === 401 && path !== '/auth/login') expireSession();
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = '/login';
}

function expireSession() {
  localStorage.removeItem(TOKEN_KEY);
  if (window.location.pathname !== '/login') window.location.href = '/login?expired=1';
}

// Backend trả thông điệp tiếng Anh; ánh xạ sang câu tiếng Việt cho người dùng.
const messages: Record<string, string> = {
  'invalid credentials': 'Tên đăng nhập hoặc mật khẩu không đúng',
  'invalid payload': 'Dữ liệu gửi lên không hợp lệ',
  'insufficient role': 'Bạn không có quyền thực hiện thao tác này',
  'code and name are required': 'Vui lòng nhập mã và tên',
  'name is required': 'Vui lòng nhập tên',
  'company code or name may already exist': 'Mã hoặc tên công ty đã tồn tại',
  'company_id and name are required': 'Vui lòng chọn công ty và nhập tên phòng ban',
  'department may already exist': 'Phòng ban này đã tồn tại trong công ty',
  'department may already exist or not found': 'Phòng ban đã tồn tại hoặc không còn trong hệ thống',
  'employee_code, username, full_name and company_id are required': 'Vui lòng nhập đủ mã nhân viên, tên đăng nhập, họ tên và công ty',
  'password is required for a new employee': 'Nhân viên mới bắt buộc có mật khẩu ban đầu',
  'username or employee code may already exist': 'Tên đăng nhập hoặc mã nhân viên đã tồn tại',
  'user update failed, check unique fields and references': 'Không cập nhật được nhân viên, có thể trùng mã nhân viên hoặc tên đăng nhập',
  'user not found': 'Không tìm thấy nhân viên, có thể đã bị xoá',
  'company not found': 'Không tìm thấy công ty, có thể đã bị xoá',
  'department not found': 'Không tìm thấy phòng ban, có thể đã bị xoá',
  'project not found': 'Không tìm thấy dự án, có thể đã bị xoá',
  'invalid role': 'Vai trò không hợp lệ',
  'invalid status': 'Trạng thái không hợp lệ',
  'only a super admin can assign the super admin role': 'Chỉ Quản trị cấp cao mới được gán vai trò Quản trị cấp cao',
  'only a super admin can modify a super admin account': 'Chỉ Quản trị cấp cao mới được thay đổi tài khoản Quản trị cấp cao',
  'you cannot change your own role or status': 'Bạn không thể tự đổi vai trò hoặc trạng thái của chính mình',
  'you cannot delete your own account': 'Bạn không thể xoá tài khoản của chính mình',
  'you cannot resign your own account': 'Bạn không thể tự cho mình nghỉ việc',
  'the built-in administrator account cannot be deleted': 'Không thể xoá tài khoản quản trị mặc định của hệ thống',
  'employee is not active': 'Nhân viên này không còn ở trạng thái đang làm việc',
  'replacement user not found': 'Không tìm thấy người thay thế',
  'replacement user must be an active employee': 'Người thay thế phải là nhân viên đang làm việc',
  'moving a department to another company is not supported': 'Không thể chuyển phòng ban sang công ty khác',
  'cannot grant access to an inactive employee': 'Không thể cấp quyền cho nhân viên đã nghỉ việc hoặc bị vô hiệu hoá',
  'level must be NONE, READ or WRITE': 'Mức quyền không hợp lệ',
  'replacement user cannot be the resigned employee': 'Người thay thế không được là chính nhân viên nghỉ việc',
  'company_id, code and name are required': 'Vui lòng nhập đủ công ty, mã và tên dự án',
  'project code may already exist in this company': 'Mã dự án đã tồn tại trong công ty này',
  'project update failed': 'Không cập nhật được dự án',
  'user_id and project_id are required': 'Vui lòng chọn nhân viên và dự án',
  'permission save failed, check user/project/resource references': 'Không lưu được quyền, hãy kiểm tra lại nhân viên và dự án',
  'avatar is invalid': 'Ảnh đại diện không hợp lệ',
  'avatar is too large': 'Ảnh đại diện quá lớn, hãy chọn ảnh nhỏ hơn',
};

export function errorMessage(err: unknown, fallback = 'Có lỗi xảy ra, vui lòng thử lại'): string {
  // fetch ném TypeError khi không kết nối được máy chủ (thông điệp khác nhau giữa các trình duyệt).
  if (err instanceof TypeError) return 'Không kết nối được máy chủ, vui lòng kiểm tra mạng và thử lại';
  if (!(err instanceof Error)) return fallback;
  if (messages[err.message]) return messages[err.message];
  const department = err.message.match(/^department has (\d+) active user/);
  if (department) return `Phòng ban đang có ${department[1]} nhân sự nên không thể xoá`;
  // Lỗi 5xx thường chứa thông tin kỹ thuật của CSDL, không hiển thị cho người dùng.
  if (err instanceof ApiError && err.status >= 500) return fallback;
  return err.message || fallback;
}
