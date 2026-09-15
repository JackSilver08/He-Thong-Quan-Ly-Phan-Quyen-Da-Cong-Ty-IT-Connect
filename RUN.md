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

**Lần chạy đầu tiên có thể lâu** vì Docker phải tải base images và build frontend/backend/dashboard. Sau khi image đã được build, `run.ps1`/`run.bat` mặc định **không rebuild**, nên các lần khởi động sau sẽ nhanh hơn nhiều.

Nếu bạn vừa thay đổi Dockerfile, `package.json`, `go.mod`, `requirements.txt` hoặc muốn ép build lại:

```powershell
.\run.ps1 -Rebuild
```

Hoặc:

```text
run.bat rebuild
```

Script sẽ:

1. Tự tạo `.env` từ `.env.example` nếu chưa có.
2. Tái sử dụng Docker images đã build khi có sẵn.
3. Chỉ build khi image ứng dụng chưa tồn tại hoặc bạn chủ động yêu cầu rebuild.
4. Chờ API health check và frontend sẵn sàng.
5. Tự mở trình duyệt mặc định vào IT Connect.

## Linux/macOS

```bash
chmod +x run.sh
./run.sh
```

Rebuild thủ công:

```bash
REBUILD=1 ./run.sh
```

## Cách Docker trực tiếp

Khởi động nhanh, sử dụng image hiện có:

```bash
docker compose up -d
```

Build lại toàn bộ:

```bash
docker compose up -d --build
```

Lưu ý: không cần `docker pull` thủ công từng image. Docker Compose/BuildKit sẽ xử lý dependency và cache image.

## Địa chỉ dịch vụ

- Web app: http://localhost:3000
- API: http://localhost:8080
- Health check: http://localhost:8080/health
- Analytics dashboard: http://localhost:8501
- Nginx gateway: http://localhost:8088

## Tạo file môi trường

Lần đầu chạy, launcher tự tạo `.env`. Nếu muốn chủ động tạo:

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

Khởi động nhanh:

```bash
docker compose up -d
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

## Troubleshooting build chậm hoặc timeout

### Docker Hub timeout

Không pre-pull tuần tự các image. Launcher hiện đã bỏ cơ chế này để tránh phải chờ từng image một.

Kiểm tra Docker Desktop/network bằng:

```powershell
docker info
docker pull node:22-alpine
```

Nếu `docker pull` cũng timeout, vấn đề nằm ở kết nối Docker Hub/DNS/proxy/VPN, không phải source code.

### Build lại khi source thay đổi

```powershell
.\run.ps1 -Rebuild
```

### Kiểm tra trạng thái

```bash
docker compose ps
docker compose logs --tail=100
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
docker compose up -d --build
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
