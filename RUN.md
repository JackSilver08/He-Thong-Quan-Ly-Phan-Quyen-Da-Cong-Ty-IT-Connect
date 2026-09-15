# Hướng dẫn khởi động IT Connect

## Yêu cầu

- Docker Desktop hoặc Docker Engine + Docker Compose
- Git

Không cần cài Go, Node.js, PostgreSQL, Redis hoặc Python để chạy bản Docker.

## Windows: một lệnh duy nhất và tự mở trình duyệt

Từ thư mục gốc repository, chạy:

```powershell
.\run.ps1
```

Hoặc double-click:

```text
run.bat
```

Hai cách này sẽ:

1. Build và khởi động toàn bộ stack ở chế độ nền.
2. Chờ frontend `http://localhost:3000` sẵn sàng.
3. Tự mở trình duyệt mặc định vào IT Connect.

## Linux/macOS

```bash
chmod +x run.sh
./run.sh
```

Script sẽ build/start toàn bộ stack, chờ frontend sẵn sàng rồi mở trình duyệt nếu hệ điều hành hỗ trợ.

## Cách Docker trực tiếp

Nếu không cần tự mở trình duyệt:

```bash
docker compose up --build
```

Lệnh này build và khởi động toàn bộ stack:

- PostgreSQL
- Go/Gin API
- Next.js frontend
- Streamlit dashboard
- Nginx

## Địa chỉ dịch vụ

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

## Điều khiển hệ thống

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

Xem log:

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

## Luồng khởi động

```text
run.ps1 / run.bat / run.sh
          |
          v
    Docker Compose
          |
    +-----+------------------+
    |                        |
    v                        v
PostgreSQL               Go/Gin API
                           |
                           +--> JWT / RBAC
                           +--> Users / Companies / Projects
                           +--> Permissions / Audit
    |
    +------------------------------+
                                   |
                                   v
                           Next.js frontend

                           Streamlit dashboard

                           Nginx gateway
```

## Troubleshooting cơ bản

### Docker chưa chạy

Mở Docker Desktop rồi chạy lại `run.ps1` hoặc `run.bat`.

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

### Frontend chưa sẵn sàng

```bash
docker compose ps
docker compose logs -f frontend
```

### Database cũ gây lỗi schema

Chỉ dùng trong development:

```bash
docker compose down -v
docker compose up --build
```

Lệnh `-v` sẽ xóa dữ liệu PostgreSQL của Docker.

## Production checklist

Trước khi đưa lên server thật:

1. Đổi toàn bộ secret và password mặc định.
2. Giới hạn `CORS_ORIGINS` về domain thật.
3. Đặt HTTPS phía trước bằng Nginx/Reverse Proxy.
4. Backup PostgreSQL và kiểm tra khả năng restore.
5. Không commit `.env` vào Git.
6. Chưa áp quyền NTFS thật cho File Server trước khi hoàn thiện AD/LDAP, service account và permission workflow.
7. Kiểm thử offboarding: user nghỉ việc phải được khóa/revoke đúng quy trình.
