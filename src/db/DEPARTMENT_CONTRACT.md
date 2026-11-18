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

- Queries live in `src/lib/<module>/queries.ts`. Start with `resolveOrg` / `requireOrg`, then check
  a rule from `can` in `src/lib/access/access.ts` (`assertCan(can.manageStaff(org.access))`).
  New rules go in that file, not inline. Row Level Security only guarantees company isolation.
- Problems the user can fix are thrown as `UserError`; anything else is a bug.
- Server actions live in `actions.ts`, take the user from `requireSession()`, and wrap their body
  in `runAction` so `UserError` messages reach the screen (production hides thrown messages).
  Clients call them through `unwrap(...)`.
- Add a test in `tests/` for every permission rule and workflow rule.

## 6. Forms that are signed

- A document that ends in signature boxes gets a chain in `src/lib/signoffs/chains.ts`.
- Raise it with `assertChainStaffed` + `signAsPreparer`; sign it with `verifyApprovalPin` (before
  the transaction) and `signNextStep`. `src/lib/vacation/queries.ts` is the reference.
- Its page shows the form as it prints (`Letterhead`, `SignoffBoxes`) with a `SignPanel` above it.

## 7. Routing

- Pages live under `src/app/(app)/[orgCode]/...` and start with `loadOrgPage()` (`src/lib/org/page.ts`).
