# Hệ Thống Quản Lý Phân Quyền Đa Công Ty IT Connect

Monorepo MVP cho hệ thống quản trị nhân viên, công ty, dự án và quyền truy cập File Server.

## Stack
- Frontend: Next.js 16 + TypeScript + Tailwind CSS
- Backend: Go 1.27 + Gin + pgx
- Database: PostgreSQL 18
- Analytics: Streamlit + Plotly
- Deploy: Docker Compose

## Chức năng MVP
- Đăng nhập JWT / RBAC
- CRUD công ty, phòng ban, nhân viên, dự án
- Thành viên dự án
- Permission NONE / READ / WRITE (hiển thị X/R/W)
- Danh sách nghỉ việc + nhân viên thay thế
- Audit log
- Dashboard tổng quan
- Health check

## Chạy local bằng Docker
1. Copy `.env.example` thành `.env`.
2. `docker compose up --build`
3. Frontend: http://localhost:3000
4. API: http://localhost:8080
5. Dashboard: http://localhost:8501

Tài khoản dev mặc định được tạo khi backend khởi động lần đầu theo ADMIN_USERNAME / ADMIN_PASSWORD.

## Production
Thay secret, password database, giới hạn CORS, đặt Nginx/HTTPS phía trước, backup PostgreSQL, và tích hợp LDAP/Active Directory trước khi áp quyền thật vào Windows File Server.
