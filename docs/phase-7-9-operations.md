# Phases 7–9: Operations, verification and staging

This portal now includes server-side security headers, audit and structured operational logs, privacy-preserving internal analytics, encrypted production database backups, data-retention maintenance, and a containerized staging profile. This runbook describes the operator steps; it does not replace TBC ICT security acceptance, an external penetration test or a browser/device QA sign-off.

## Security and logging

- The middleware generates a per-response nonce for the CSP `script-src`; development alone permits `unsafe-eval`. The policy also sets `object-src 'none'`, `frame-ancestors 'none'`, and same-origin form/base restrictions.
- `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, `Cross-Origin-Opener-Policy`, request IDs and production HTTPS HSTS are set at the app edge. TLS must terminate at an approved HTTPS reverse proxy.
- Use `TRUSTED_PROXY_HOPS` only when a network-controlled proxy overwrites/appends `X-Forwarded-For`. Set `0` for direct local connections. Staging compose assumes one trusted proxy hop; do not expose its app port directly to the internet.
- Set `SESSION_SECRET` to a distinct random 32-byte-or-longer secret. Never reuse it as the backup key. Choose `LOG_LEVEL=info` for staging/production. Structured logs omit fields named as credentials, contact details, IP addresses, request bodies, SQL or user agents. Audit events remain in the DB under the configured audit-retention period.

## Database backups and restore

`npm run db:backup` creates an atomic, mode-restricted JSON database snapshot under `BACKUP_DIR`; production requires `BACKUP_ENCRYPTION_KEY`, and the file is AES-256-GCM encrypted with an authenticated integrity check. Generate and escrow a different random key (for example, `openssl rand -hex 32`) outside the app host. Losing it makes encrypted backups unrecoverable. In local development without a key, files are unencrypted and still contain sensitive database information; keep them private.

Backups include CMS tables and the media blobs referenced by the media library as a sibling `<backup-filename>.media/` directory. In production, each blob is AES-256-GCM encrypted; the database manifest authenticates file paths, sizes, and SHA-256 digests. Copy both the backup file and its `.media` directory together, store at least one encrypted copy off-host, restrict access, and regularly test restoring them as a pair in an isolated environment. Backups intentionally omit ephemeral login sessions, password-reset links and rate-limit counters.

Restore is destructive and invalidates sessions/reset links:

```sh
npm run db:backup
npm run db:restore -- tbc-backup-<timestamp>.json.enc
```

Always verify the filename and target database before restoring. Schedule `npm run db:backup` daily and run `npm run db:maintenance` after it (daily is a reasonable starting point) to purge expired enquiries, audit and analytics records, sessions, rate-limit rows and reset tokens, plus local backup pairs older than `BACKUP_RETENTION_DAYS` (the newest backup is always kept). For the Compose host, a protected host scheduler can run `docker compose --env-file /secure/path/.env.staging -f /path/to/repo/docker-compose.staging.yml exec -T web npm run db:backup` and then the equivalent `npm run db:maintenance`. Copy each `.json.enc` backup and matching `.media` directory off-host as a pair. Set `ANALYTICS_RETENTION_DAYS`, `BACKUP_RETENTION_DAYS` and content-retention settings to the approved schedule; confirm all periods with TBC records/privacy officers before production.

## Internal analytics

When the `analytics.internal_tracking_enabled` setting is true, the public site can report page routes, visits to the search page, and public document downloads. It does not submit search phrases, form contents, raw IPs or raw user-agent strings. A daily pseudonymous visit hash supports approximate visitor counts. Browser Do Not Track is honoured. The admin report requires `analytics.view`; no external analytics provider is loaded by this feature. Set internal tracking off if the applicable notice/approval is not in place. Analytics cleanup is configured by `ANALYTICS_RETENTION_DAYS`.

## Staging deployment (Docker Compose)

1. Copy `.env.example` to an untracked `.env.staging` and set strong unique values. Use a separate staging database and host name; never use production credentials or real personal data. Set `NEXT_PUBLIC_SITE_URL` to the externally visible HTTPS origin and `STAGING_DATABASE_URL` to a URL-encoded PostgreSQL connection string for the compose database.
2. Set `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `SESSION_SECRET`, `BACKUP_ENCRYPTION_KEY`, `TRUSTED_PROXY_HOPS=1`, and `COOKIE_SECURE=true`. Configure mail only with an authorized test SMTP recipient. Leave optional external integrations disabled.
3. Build and launch behind the approved HTTPS reverse proxy:

   ```sh
   docker compose --env-file .env.staging -f docker-compose.staging.yml up --build -d
   docker compose --env-file .env.staging -f docker-compose.staging.yml ps
   ```

   The app only binds to loopback by default, the database has no published host port, database migrations and non-personal seed data run at startup, and PostgreSQL, uploads and backups use persistent Docker volumes. TLS/reverse-proxy configuration and firewall rules are outside this repository and must be reviewed by ICT.

4. Bootstrap the first staging administrator once. Put its three `INITIAL_ADMIN_*` variables in a temporary, mode-0600, untracked `.env.bootstrap` file; export them only in the operator shell, then run `docker compose --env-file .env.staging -f docker-compose.staging.yml run --rm -e INITIAL_ADMIN_EMAIL -e INITIAL_ADMIN_NAME -e INITIAL_ADMIN_PASSWORD web npm run admin:init`. Unset the shell variables and securely remove the temporary file afterwards. Use a unique password, do not put credentials in source control/logs, and enrol MFA immediately. The seed command does not create an account.
5. Verify `GET /api/health`, public bilingual routes, forms and email status, admin role permissions, media upload/download access, scheduled content, backups, restore and maintenance. Set the public site to non-indexable and keep the staging banner enabled. Confirm that the reverse proxy is the only ingress and forwards the correct host/protocol/client IP headers.
6. After each release, run the checks below and retain the build/test logs with the release record.

## Phase 8 verification

```sh
npm ci
npm run lint
npm run test:all
npm run build
npm run db:backup
```

The Phase 8 responsive test is a source-level regression check for viewport breakpoints, reduced-motion, focus, grid and form/navigation contracts. It is not a substitute for visual testing in real browsers. Before staging sign-off, QA must still run Chromium/Firefox/WebKit (or the TBC-approved browser matrix) at desktop, tablet and narrow mobile sizes, keyboard-only and screen-reader checks, and a real authenticated workflow in an isolated staging dataset. Security checks in the repository are automated regression checks, not a penetration test.
