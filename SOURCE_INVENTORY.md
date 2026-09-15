# Source Inventory

## Backend
- `backend/cmd/api/main.go`: API bootstrap, CORS, routes, graceful shutdown.
- `backend/internal/config`: environment configuration.
- `backend/internal/auth`: Argon2id password hashing + JWT.
- `backend/internal/db`: PostgreSQL connection pool.
- `backend/internal/repository`: PostgreSQL queries for core modules.
- `backend/internal/handler`: REST handlers.
- `backend/internal/middleware`: JWT authentication and role guard.
- `backend/migrations/001_init.sql`: PostgreSQL schema + initial IT Connect company/IT department.

## Frontend
- Next.js 16 / TypeScript.
- `app/`: dashboard, login, users, companies, projects, permissions, resigned, audit pages.
- `components/`: shared layout/auth guard.
- `lib/api.ts`: authenticated API client.

## Dashboard
- Streamlit + Plotly skeleton for analytics.

## Deployment
- Dockerfiles for backend/frontend/dashboard.
- Docker Compose for PostgreSQL, backend, frontend, Nginx and dashboard.
- `infra/nginx/default.conf` for reverse proxy.
