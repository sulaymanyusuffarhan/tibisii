#!/bin/sh
set -eu
: "${DATABASE_URL:?Set STAGING_DATABASE_URL in the protected environment file}"
: "${NEXT_PUBLIC_SITE_URL:?Set the public HTTPS staging URL}"
: "${SESSION_SECRET:?Set SESSION_SECRET (openssl rand -hex 32)}"
: "${BACKUP_ENCRYPTION_KEY:?Set BACKUP_ENCRYPTION_KEY (openssl rand -hex 32)}"
[ "${#SESSION_SECRET}" -ge 32 ] || { echo 'SESSION_SECRET must be at least 32 characters.' >&2; exit 1; }
[ "${#BACKUP_ENCRYPTION_KEY}" -ge 32 ] || { echo 'BACKUP_ENCRYPTION_KEY must be at least 32 characters.' >&2; exit 1; }
case "$SESSION_SECRET:$BACKUP_ENCRYPTION_KEY" in *REPLACE_WITH*|*change_me*) echo 'Replace all sample secrets with unique random values.' >&2; exit 1;; esac
[ "$SESSION_SECRET" != "$BACKUP_ENCRYPTION_KEY" ] || { echo 'Use distinct SESSION_SECRET and BACKUP_ENCRYPTION_KEY values.' >&2; exit 1; }
case "$NEXT_PUBLIC_SITE_URL" in https://*) ;; *) echo 'NEXT_PUBLIC_SITE_URL must use HTTPS in staging.' >&2; exit 1;; esac
case "$DATABASE_URL" in postgresql://*|postgres://*) ;; *) echo 'Staging DATABASE_URL must target PostgreSQL.' >&2; exit 1;; esac
[ "${COOKIE_SECURE:-true}" = 'true' ] || { echo 'COOKIE_SECURE must be true for staging.' >&2; exit 1; }
[ "${AUTO_INIT_DB:-false}" = 'false' ] || { echo 'Staging requires AUTO_INIT_DB=false; migrations are run explicitly at startup.' >&2; exit 1; }
npm run db:migrate
npm run db:seed
exec npm run start
