# Department module contract (RBAC / RLS)

Every future department module (ops, accounts, quotations, invoices, …) must follow this contract.

## 1. Tenant key

- Canonical tenant is `organizations.id` (UUID).
- Human URL is `/{ORG_CODE}/...` only.
- Never authorize using the URL code alone — resolve code → org UUID on the server, then query by UUID.

## 2. Table rules

Each business table must include:

```sql
organization_id uuid not null references organizations(id)
```

Recommended indexes:

- `(organization_id)`
- composite indexes that start with `organization_id` for list queries

## 3. RLS rules

In the **same migration** that creates the table:

1. `alter table <name> enable row level security;`
2. Policies that require `app_user_is_org_member(organization_id)` for select/insert/update/delete
3. App queries must run inside `withTenantContext(userId, ...)` so `app.user_id` is set

## 4. Access helpers

- Prefer shared query helpers under `src/lib/<module>/`
- Always take authenticated `userId` from session (`requireSession()`)
- Check membership / permission before mutations that are not covered solely by RLS

## 5. Routing

- Nest routes under `src/app/(app)/[orgCode]/...`
- Do not create top-level module paths that bypass org context

## 6. Permissions

- Add stable permission keys to seed catalog when introducing a module (e.g. `invoices.read`)
- Bind them to org roles via `role_permissions`
- UI may hide actions, but server + RLS remain the source of truth
