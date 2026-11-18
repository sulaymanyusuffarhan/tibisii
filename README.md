# TBC Corporate Communication Portal

The project is being delivered in phases. See the [Phase 2 database and authentication guide](docs/phase-2-database-auth.md) and [Phase 3 administration dashboard and CMS guide](docs/phase-3-cms.md) for current setup, workflow, account and verification instructions.

Quick local foundation checks:

```sh
npm ci
npm run db:migrate
npm run db:seed
npm run test:phase2
npm run test:phase3
npm run lint
```

No administrator account is created by database seeding. Configure private bootstrap environment variables and follow the administrator bootstrap procedure in the Phase 2 guide.
