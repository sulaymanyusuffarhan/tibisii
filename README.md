# TBC Corporate Communication Portal

The project is being delivered in phases. See [Phase 2 database and authentication setup](docs/phase-2-database-auth.md) for the database, administrator bootstrap, RBAC, MFA, password reset and verification procedures currently implemented.

Quick local foundation checks:

```sh
npm ci
npm run db:migrate
npm run db:seed
npm run test:phase2
npm run lint
```

No administrator account is created by database seeding. Configure private bootstrap environment variables and follow the administrator bootstrap procedure in the Phase 2 guide.
