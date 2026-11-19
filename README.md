# TBC Corporate Communication Portal

The portal is delivered in phases. Setup and operations guides:

- [Phase 2: database and authentication](docs/phase-2-database-auth.md)
- [Phase 3: administration dashboard and CMS](docs/phase-3-cms.md)
- [Phase 4: public site](docs/phase-4-public-site.md)
- [Phases 7–9: security, analytics, backups, testing and staging](docs/phase-7-9-operations.md)

## Local development

```sh
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

No administrator account is created by database seeding. Configure private bootstrap environment variables and follow the administrator bootstrap procedure in the Phase 2 guide.

## Verification

```sh
npm run lint
npm run test:all
npm run build
```

The regression suite covers database/auth, CMS workflow, public content, public forms/media, locale behavior, security headers and analytics/backups. Responsive automated checks validate source-level breakpoints and accessibility contracts; visual browser/device QA and an external penetration test remain staging sign-off requirements.
