# AlJazayeh Internal System

Company internal platform (360°) with multi-organization tenancy, RBAC, and Postgres Row Level Security (RLS).

For a full product/architecture walkthrough (modules, inquiry CRM, multi-company bootstrap, workflows), see **[SYSTEM.md](SYSTEM.md)**.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js (App Router) + TypeScript + Tailwind |
| DB | PostgreSQL (local Windows now, VPS later) |
| ORM | Drizzle |
| Auth | Cookie session + bcrypt password hashes |
| Tenancy | `organizations.id` (UUID) + URL `/{ORG_CODE}` |

## Local setup

1. PostgreSQL 17 installed locally (already used for this project).
2. Copy env:

```bash
cp .env.example .env.local
```

3. Ensure `.env.local` has:

- `DATABASE_URL` — app role (RLS applies)
- `DATABASE_URL_ADMIN` — migrator/superuser
- `AUTH_SECRET` — long random string

4. Install + migrate + seed:

```bash
npm install
npm run db:setup
npm run dev
```

Login: `admin` / `admin`

## Canonical model

```text
Organization (tenant)
  └── Membership (user ↔ org)
        └── Roles → Permissions (RBAC)
```

- URL: `/{ORG_CODE}`
- RLS session GUC: `app.user_id`
- Helper: `withTenantContext(userId, ...)`

Department modules must follow [src/db/DEPARTMENT_CONTRACT.md](src/db/DEPARTMENT_CONTRACT.md).

## Scripts

- `npm run db:generate` — create Drizzle SQL migrations
- `npm run db:migrate` — apply migrations + RLS
- `npm run db:seed` — seed admin + permission catalog
- `npm run db:setup` — migrate + seed
