# AlJazayeh Internal System

Company internal platform (360°) with multi-organization tenancy, RBAC, and Postgres Row Level Security (RLS).

For a full product/architecture walkthrough (modules, inquiry CRM, multi-company bootstrap, workflows), see **[SYSTEM.md](SYSTEM.md)**.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js (App Router) + TypeScript + Tailwind |
| DB | PostgreSQL 16+ |
| ORM | Drizzle |
| Auth | Cookie session + bcrypt password hashes |
| Tenancy | `organizations.id` (UUID) + URL `/{ORG_CODE}` |

## Local setup

1. PostgreSQL 16 or newer, with an empty database and an owner login for it.
2. Copy env:

```bash
cp .env.example .env.local
```

3. Ensure `.env.local` has:

- `DATABASE_URL` — the app's own login role (RLS applies). Created for you by the migration step.
- `DATABASE_URL_ADMIN` — owner of the database, used only for migrations and seeding
- `AUTH_SECRET` — long random string

4. Install + migrate + seed:

```bash
npm install
npm run db:setup
npm run dev
```

Development login: `admin` / `admin` (the owner). In production, set `OWNER_USERNAME` and
`OWNER_PASSWORD` before seeding; `admin` / `admin` is refused there.

## Canonical model

```text
Company (tenant)
  └── Staff member ── optional login (user)
        ├── departments  → what they can open and do
        └── administrator flag → company settings and logins
```

- A person can use a company when they have an **active staff record with a login** there.
- Every rule about who may do what is in `src/lib/access/access.ts`.
- The database (Row Level Security) keeps companies apart and blocks privilege escalation.
- URL: `/{ORG_CODE}`; queries run inside `withTenantContext(userId, ...)`.

Modules must follow [src/db/DEPARTMENT_CONTRACT.md](src/db/DEPARTMENT_CONTRACT.md).

## Scripts

- `npm run check` — lint + typecheck
- `npm test` — permission and workflow tests against the database in `.env.local`
- `npm run db:generate` — write a migration from changes in `src/db/schema.ts`
- `npm run db:migrate` — apply migrations, provision the app role, verify every table has RLS
- `npm run db:seed` — create the owner login
- `npm run db:setup` — migrate + seed

Changing the database: see [src/db/DEPARTMENT_CONTRACT.md](src/db/DEPARTMENT_CONTRACT.md) §4.
