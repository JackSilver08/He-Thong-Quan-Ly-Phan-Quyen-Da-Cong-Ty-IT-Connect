# IT Connect Architecture

## Request flow
Browser → Nginx → Next.js / Go API → PostgreSQL.

## Responsibilities
- Next.js: UX, forms, tables, filtering, navigation.
- Go/Gin: authentication, authorization, business rules, REST API, audit logging.
- PostgreSQL: source of truth for identity, company, project and permission data.
- Redis: reserved for cache, rate limiting and background jobs.
- Streamlit: analytics/reporting only, never the source of authorization decisions.
- Active Directory / File Server: future resource plane. The web app remains the control plane.

## Permission model
NONE → X, READ → R, WRITE → W.

Do not model X as a blanket SQL DELETE. A denied permission must remain auditable and explicit.

## Security rules
- Never store plaintext passwords.
- Replace development JWT secret and database password before production.
- Use short-lived access tokens and rotate/refresh strategy before internet exposure.
- Add CSRF protection if cookie-based auth is introduced.
- Use least-privileged service accounts for AD/File Server integration.
- Require approval/audit for bulk permission changes and employee offboarding.
