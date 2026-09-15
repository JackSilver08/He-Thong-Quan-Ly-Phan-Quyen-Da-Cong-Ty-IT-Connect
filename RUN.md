# Hướng dẫn khởi động IT Connect

## Yêu cầu

- Docker Desktop hoặc Docker Engine + Docker Compose
- Git

Không cần cài Go, Node.js, PostgreSQL, Redis hoặc Python để chạy bản Docker.

## Cách chạy nhanh nhất

Từ thư mục gốc repository, chạy đúng **một lệnh**:

```bash
docker compose up --build
```

Lệnh này build và khởi động toàn bộ stack:

- PostgreSQL
- Go/Gin API
- Next.js frontend
- Streamlit dashboard
- Nginx

Sau khi các container khởi động:

- Web app: http://localhost:3000
- API: http://localhost:8080
- Health check: http://localhost:8080/health
- Analytics dashboard: http://localhost:8501
- Nginx gateway: http://localhost:8088

## Tạo file môi trường

Lần đầu chạy, copy `.env.example` thành `.env`.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Linux/macOS:

```bash
cp .env.example .env
```

Có thể thay `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET` và `DATABASE_URL` trong `.env` trước khi chạy.

## Tài khoản quản trị development

Backend tự tạo tài khoản quản trị khi khởi động lần đầu dựa trên:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@123456
```

Không sử dụng các giá trị mặc định này trong production.

## Một lệnh duy nhất cho từng nhu cầu

Chạy và xem log trực tiếp:

```bash
docker compose up --build
```

Chạy nền:

```bash
docker compose up -d --build
```

Dừng hệ thống:

```bash
docker compose down
```

Xóa cả database volume trong môi trường development:

```bash
docker compose down -v
```

## Nếu muốn dùng Make

Lệnh ngắn:

```bash
make dev
```

Hoặc chạy nền:

```bash
make up
```

## Luồng khởi động

```text
Docker Compose
    |
    +--> PostgreSQL (healthy)
    |
    +--> Go/Gin API
    |       |
    |       +--> JWT / RBAC
    |       +--> Users / Companies / Projects
    |       +--> Permissions / Audit
    |
    +--> Next.js frontend
    |
    +--> Streamlit dashboard
    |
    +--> Nginx gateway
```

## Troubleshooting cơ bản

### Port bị chiếm

Các port mặc định:

```text
3000  Next.js
5432  PostgreSQL
8080  Go API
8088  Nginx
8501  Streamlit
```

Nếu port đã được ứng dụng khác sử dụng, chỉnh mapping trong `docker-compose.yml`.

### Database cũ gây lỗi schema

Chỉ dùng trong development:

```bash
docker compose down -v
docker compose up --build
```

Lệnh `-v` sẽ xóa dữ liệu PostgreSQL của Docker.

### Xem log

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

## Production checklist

Trước khi đưa lên server thật:

1. Đổi toàn bộ secret và password mặc định.
2. Giới hạn `CORS_ORIGINS` về domain thật.
3. Đặt HTTPS phía trước bằng Nginx/Reverse Proxy.
4. Backup PostgreSQL và kiểm tra khả năng restore.
5. Không commit `.env` vào Git.
6. Chưa áp quyền NTFS thật cho File Server trước khi hoàn thiện AD/LDAP, service account và permission workflow.
7. Kiểm thử offboarding: user nghỉ việc phải được khóa/revoke đúng quy trình.
