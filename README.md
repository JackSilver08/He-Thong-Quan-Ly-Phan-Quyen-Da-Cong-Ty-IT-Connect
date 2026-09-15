# Hệ Thống Quản Lý Phân Quyền Đa Công Ty IT Connect

Monorepo cho hệ thống quản trị nhân viên, công ty, phòng ban, dự án, tài nguyên thư mục và quyền truy cập File Server.

## Kiến trúc
- Frontend: Next.js 16 + TypeScript + Tailwind CSS
- Backend: Go 1.27 + Gin + pgx
- Database: PostgreSQL 18
- Analytics: Streamlit + Plotly
- Infrastructure: Docker Compose + Nginx

## V2
- Project members
- Resource / Folder hierarchy
- Direct permission metadata
- Effective permission lookup
- Account type foundation
- Detailed audit fields foundation

## Chạy local
```powershell
.\run.ps1
```

## Production
Thay toàn bộ secret mặc định, giới hạn CORS, bật HTTPS, backup PostgreSQL, rate limiting, session/refresh-token strategy và chỉ tích hợp AD/Windows File Server sau khi hoàn thành security hardening.
