# Phase 3 — administration dashboard and CMS

Phase 3 adds an operational administration workspace over the Phase 2 database and authentication APIs. Content is read from and written to the database; the dashboard does not use demonstration metrics or browser-local persistence.

## Administration areas

- **Overview:** live counts for published articles, drafts, review workload, publications, events, media records, open enquiries and pending testimonials; six-month article creation activity and recent audit history.
- **Articles & stories:** bilingual draft editing, selectable institutional section, summary and rich-text content.
- **Institutional pages:** bilingual title, summary and rich-text body fields.
- **Events:** bilingual details, dates, category, image URL and featured flag.
- **Publications:** bilingual metadata, date, category and document URL. File upload is a later media/document phase.
- **User accounts:** list staff accounts, create accounts with a role and initial password, activate/deactivate accounts, and let a Super Administrator reset MFA when required. Deactivation and MFA reset revoke active sessions.
- **Roles & permissions:** create custom roles and configure known permissions. The built-in Super Administrator role is immutable.
- **Account security:** start and verify TOTP MFA enrollment and display one-time recovery codes.

A rich-text toolbar supports headings, bold/italic, lists, block quotes, hyperlinks and tables. Rich HTML is sanitized on the server before storage. Media selection and uploads are not included yet; image and document fields currently accept secure HTTPS URLs or local asset paths.

## Editorial workflow

New content is always saved as a draft. The record-level action menu can submit for review, move an item into review, request changes, approve/reject, schedule, publish or archive, subject to server-side permissions and configured workflow rules. Editing any non-draft item automatically returns it to draft and clears its prior approval/publication state so unreviewed edits cannot remain public. Authors cannot approve or reject their own items (Super Administrator emergency access remains available). Scheduled records are promoted by the existing database scheduler. The public language status is published only when the translation has a title; an absent English version remains a draft.

## Run and initialize

```sh
npm ci
cp .env.example .env.local
# Configure a unique SESSION_SECRET and private database credentials.
npm run db:migrate
npm run db:seed
npm run admin:init
npm run dev
```

Open `/admin/login`. Create a dedicated administrator account with `admin:init` only for an empty account; later staff accounts are created in User Accounts. Do not use demonstration identities for official users, and do not put passwords in source control. In production, set `COOKIE_SECURE=true`, use HTTPS, configure PostgreSQL and authorized SMTP, and store credentials in the institution's approved secret store.

## Routes added

- `/admin/login`, `/admin/forgot-password`, `/admin/reset-password`
- `/admin/dashboard`, `/admin/content/articles`, `/admin/content/pages`, `/admin/content/events`, `/admin/content/publications`
- `/admin/users`, `/admin/roles`, `/admin/security`
- `/api/admin/dashboard`
- `/api/admin/content/:collection` and `/:id`, plus `/:id/workflow`

All content routes use an allowlisted collection/table mapping. Administrative mutations require the session CSRF token. Record access is checked server-side; contributor queries are limited to their own articles. Draft create/update/delete and workflow changes are persisted and audited.

## Verification

```sh
npm run test:phase2
npm run test:phase3
npm run lint
npm run build
npm audit
```

The Phase 3 test exercises workflow permission boundaries, rich-text sanitization and scheduled publishing for each collection. Manual API integration checks also cover login, dashboard metrics, article workflow, CRUD for institutional pages/events/publications, and CSRF rejection.

## Still planned for later phases

This phase does not include media uploads, full document storage/preview, form-submission moderation screens, homepage/page-builder and menu management, public site rendering, advanced search, bilingual public routes, complete settings management, analytics export, backups UI or external integrations. These remain planned for later phases. The implementation is not a formal eGA/TBC ICT security or compliance certification.
