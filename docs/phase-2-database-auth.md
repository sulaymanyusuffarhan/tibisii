# Phase 2 — database, authentication and permissions

Phase 2 establishes the persistence and identity foundation. It does **not** claim that the complete CMS or production hardening is finished.

## Database

- PostgreSQL 15+ is the target deployment database. Configure `DATABASE_URL` and optionally `DATABASE_SSL=true` for an authorized PostgreSQL service.
- `pglite://./storage/pgdata` is the default durable local-development database. `pglite://memory://` is used only for tests.
- SQL migrations are ordered files in `db/migrations/`; `schema_migrations` tracks applied files. Migration application is transactional.
- Migration `001_initial_schema.sql` defines the initial relational CMS schema. Migration `002_auth_hardening.sql` adds case-insensitive unique email enforcement, authentication indexes and database checks. Migration `003_mfa_attempt_controls.sql` adds separate MFA lockout counters and controls.
- `npm run db:migrate` applies migrations. `npm run db:seed` idempotently seeds seven baseline roles, replaceable site settings, and starter taxonomy. It **does not create an account**.
- `AUTO_INIT_DB=true` (local default) applies migrations/seeds at application initialization. Use explicit deployment migrations and `AUTO_INIT_DB=false` in controlled environments.

## Bootstrap the first administrator

1. Copy `.env.example` to a private `.env` file and configure the database.
2. Provide `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, and a unique password of at least 16 characters. Generate `SESSION_SECRET` with `openssl rand -hex 32` or an equivalent cryptographically secure generator.
3. Run `npm run admin:init`. It migrates and seeds, creates only the first specified Super Administrator, and refuses to overwrite an existing account. Never commit `.env` or use the old example credentials.
4. Configure authorized HTTPS and SMTP before staging/production use. Sign in, enable MFA, store the one-time recovery codes securely, then remove bootstrap variables from the runtime environment.

There is no default or public administrator account. Losing `SESSION_SECRET` makes encrypted MFA secrets unrecoverable; back it up in the organization's approved secrets manager.

## Authentication and security behavior

- Passwords use bcrypt cost 12; reset requires at least 12 characters. Password reset tokens are 256-bit random values stored as SHA-256 hashes, expire after 30 minutes, can be used once, and revoke all sessions. Responses do not reveal whether an email address is registered.
- Sessions are opaque random bearer values in HttpOnly, SameSite=Strict cookies; only SHA-256 hashes are stored. Cookie Secure mode is controlled by `COOKIE_SECURE` or HTTPS proxy detection. CSRF tokens are per-session and required by `requireApiAuth` for state-changing administrative APIs.
- Failed sign-ins increment a database counter; the account locks after `MAX_LOGIN_ATTEMPTS` for `LOGIN_LOCKOUT_MINUTES`. Login and password-reset request routes also use a PostgreSQL-backed IP rate limiter.
- Optional TOTP MFA uses RFC 6238 codes. MFA secrets are AES-256-GCM encrypted at rest using a key derived from `SESSION_SECRET`. Recovery codes are returned only once and stored as hashes. Authentication succeeds only with a TOTP or unused recovery code when MFA is enabled.
- Deactivated accounts cannot sign in and their live sessions are deleted. A user cannot deactivate their own account or the final active Super Administrator.
- Audit events record sign-in, sign-out, reset, MFA, account and permission administration events. Sensitive credential values are not written to audit records.
- Role membership is database-backed. Permission checks are server-side; users receive permissions from their current role at session lookup (not stale client claims). Built-in roles cover Super Administrator, Communication Director, Editor, Contributor, Publications Officer, Media Manager and Read-only Administrator. Custom roles and permission lists are supported; the Super Administrator role is immutable.

## Authentication API available in this phase

- `POST /api/auth/login` — email, password, optional MFA code; sets the HttpOnly session cookie and returns a CSRF token.
- `POST /api/auth/logout` — revokes the server session and expires the cookie.
- `GET /api/auth/me` — current safe user profile plus CSRF token.
- `POST /api/auth/password-reset/request` — generic confirmation; sends a reset link only if SMTP is configured.
- `POST /api/auth/password-reset/complete` — one-time token and new password.
- `POST /api/auth/mfa/setup`, then `POST /api/auth/mfa/confirm` — authenticated TOTP enrollment; save recovery codes immediately.
- `/api/admin/users` and `/api/admin/users/:id` — user listing, account creation and activation/deactivation (`users.manage`).
- `/api/admin/roles` — inspect roles/permission catalog and create/edit roles (`roles.manage`).

JSON state changes on authenticated admin endpoints require `x-csrf-token` from login or `/api/auth/me`. API functionality is available for the later dashboard to consume; the administration interface is delivered in a later phase.

## Verification

Run:

```sh
npm run db:migrate
npm run db:seed
npm run test:phase2
npm run lint
```

`test:phase2` runs against isolated in-memory PGlite and checks migrations and idempotence, baseline RBAC decisions, password login, hashed session storage and revocation, encrypted TOTP enrollment/login, and one-use password reset. It creates no durable test data.

Before deployment, TBC ICT must review network controls, HTTPS termination, database backups, secrets management, SMTP authorization, monitoring/alerting, recovery procedures, MFA policy, retention rules and security testing. The implementation is not a government certification or compliance attestation.
