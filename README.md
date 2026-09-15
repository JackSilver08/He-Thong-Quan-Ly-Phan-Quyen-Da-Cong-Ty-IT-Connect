# Hệ Thống Quản Lý Phân Quyền Đa Công Ty IT Connect

Monorepo MVP cho hệ thống quản trị nhân viên, công ty, phòng ban, dự án, tài nguyên thư mục và quyền truy cập File Server.

## Kiến trúc
- Frontend: Next.js 16 + TypeScript + Tailwind CSS
- Backend: Go 1.27 + Gin + pgx
- Database: PostgreSQL 18
- Analytics: Streamlit + Plotly
- Infrastructure: Docker Compose + Nginx

## Module cốt lõi
- Authentication / JWT / RBAC
- Company & Department management
- Employee management
- Project & Project Member
- Resource / Folder hierarchy
- Permission NONE / READ / WRITE, hiển thị X / R / W
- Resignation & replacement history
- Advanced search
- Audit logs
- Excel import / export foundation
- Analytics dashboard

## Database
Schema chuẩn hóa nằm trong `backend/db/schema/`:
- `001_full_schema.sql`: companies, departments, users, projects, project_members, resources, permissions, replacements, audit logs và indexes.
- `002_seed.sql`: dữ liệu starter cho development.

Không sử dụng workbook legacy làm schema trực tiếp. Workbook chỉ là nguồn migration/import và cần được validate trước khi ghi database.

## Chạy local bằng Docker
1. Copy `.env.example` thành `.env`.
2. Chạy `docker compose up --build`.
3. Frontend: http://localhost:3000
4. API: http://localhost:8080
5. Dashboard: http://localhost:8501

Tài khoản dev mặc định được tạo theo `ADMIN_USERNAME` / `ADMIN_PASSWORD`. Hãy thay đổi ngay khi triển khai.

## Production checklist
- Thay toàn bộ secret mặc định.
- Giới hạn `CORS_ORIGINS` theo domain thật.
- Không lưu hoặc commit password plaintext.
- Bật HTTPS qua Nginx.
- Backup PostgreSQL và kiểm tra restore định kỳ.
- Thêm rate limiting, refresh-token/session strategy và monitoring.
- Tích hợp LDAP/Active Directory trước khi áp quyền thật.
- Chỉ cho service account quyền tối thiểu khi thao tác Windows File Server/NTFS ACL.
