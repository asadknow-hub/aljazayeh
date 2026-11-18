# Module contract (tenancy and data access)

Every module that stores company data follows these rules.

## 1. Tenant key

- The tenant is `organizations.id` (UUID). The URL carries the human code: `/{orgCode}/...`.
- Never authorize from the URL code alone. Resolve it with `resolveOrg(tx, userId, orgCode)`
  (`src/lib/org/resolve.ts`), which only returns companies the user belongs to, then query by UUID.

## 2. Tables

Each business table has:

```ts
organizationId: uuid("organization_id").notNull().references(() => organizations.id)
```

Index it, and start list-query indexes with `organization_id`.

## 3. Row Level Security

- Policies are declared on the table in `src/db/schema.ts` (`orgMemberAccess`, `allowSelect`, …),
  so `npm run db:generate` writes the table and its policies into the same migration.
- `npm run db:migrate` refuses to finish if any table has no Row Level Security.
- App queries run inside `withTenantContext(userId, ...)`, which sets `app.user_id` for the policies.
- SQL functions (anything `app_*`) change through a custom migration:
  `npx drizzle-kit generate --custom --name <what_changed>`.

## 4. Changing the schema

1. Edit `src/db/schema.ts`.
2. `npm run db:generate` and read the SQL it wrote.
3. `npm run db:migrate`.
4. Commit the schema change and the migration together. CI fails if they disagree.

Never edit a migration that has been applied to a database with real data; add a new one.

## 5. Server code

- Queries live in `src/lib/<module>/queries.ts`; server actions in `actions.ts` take the user from
  `requireSession()` and never from the client.
- Check permission before a mutation. Row Level Security only guarantees company isolation.

## 6. Routing

- Pages live under `src/app/(app)/[orgCode]/...` and start with `loadOrgPage()` (`src/lib/org/page.ts`).
