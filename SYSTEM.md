# AlJazayeh Internal System — Product & Architecture Overview

**AlJazayeh Internal System** (also referred to as the **360°** company platform) is a multi-company internal operations app. It is built so one login can own or join multiple companies, each company stays data-isolated, and day-to-day work (staff, reception, inquiries, approvals) happens inside a selected company.

This document describes **what the system is**, **what it does today**, **how the pieces fit together**, and **what is still shell / future work**.

---

## 1. Purpose

The product is an internal CRM + operations workspace for AlJazayeh-style companies:

- Create and switch between **companies** (organizations)
- Run **department** workspaces (Admin, Sales, Engineering, Accounts, Reception, Staff, …)
- Capture **reception visitors** and hand inquiry traffic into a locked **inquiry CRM pipeline**
- Assign people, move stages, require **management / engineering approvals** when configured
- Maintain **staff HR** records, **vacation** requests, and a cross-department **activity log**
- Keep **company profile** and **inquiry workflow settings** configurable per company
- Keep personal **account settings** (name, email, password, salary/contract) for the logged-in user

It is not a public marketing site. It is an authenticated internal tool with tenancy and RLS as first-class design.

---

## 2. Who it’s for

| Persona | What they use |
| --- | --- |
| Company creator / admin | Creates companies, Company Settings, Inquiry Settings, Admin CRM |
| Reception | Visitors log, vacation requests, timesheet shells |
| Sales / Engineering / Accounts | Department inquiry queues + invoice-stage queues |
| Management | Approves vacation on company home; can approve inquiry stages when required |
| Staff / HR | Staff directory, profiles, salary, contracts |
| Any member | Profile `/settings`, company switcher, All Logs |

---

## 3. High-level architecture

```text
Browser (Next.js App Router UI)
        │
        ▼
Server actions / RSC pages  ── requireSession()
        │
        ▼
withTenantContext(userId)   ── sets Postgres GUC app.user_id
        │
        ▼
Drizzle queries against PostgreSQL
        │
        ▼
Row Level Security (RLS)    ── membership-scoped org data
```

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 |
| Database | PostgreSQL |
| ORM / migrations | Drizzle + SQL under `drizzle/` |
| Auth | Cookie session (`aj_session`) + bcrypt password hashes |
| Tenancy | `organizations.id` (UUID) + human URL `/{ORG_CODE}` |
| App DB role | Non-owner role `aljazayeh` so RLS applies |

Canonical contract for new modules: [`src/db/DEPARTMENT_CONTRACT.md`](src/db/DEPARTMENT_CONTRACT.md).

---

## 4. Multi-company model

### 4.1 Concepts

- **Organization (company)** — tenant. UUID primary key; human-facing **code** in the URL.
- **Membership** — links a user to a company.
- **Roles / permissions** — per-company roles (creator gets system `admin` with all seeded permissions).
- **User preferences** — optional default company.

URL shape:

```text
/{orgCode}/admin
/{orgCode}/reception
/{orgCode}/company-settings
/settings          ← personal profile (not under a company)
/login
```

Org codes are normalized lowercase (`a-z`, `0-9`, single hyphens). Reserved codes (e.g. `login`, `settings`, `admin`, `api`) cannot be company codes.

### 4.2 Creating a company

When a user creates a company, the system bootstraps a full working shell for that tenant:

1. Organization row
2. First membership via secure bootstrap (`app_insert_org_membership`)
3. `organization_settings` seeded with creator **Admin name / email**
4. Default **inquiry workflow** rows (every stage → Admin, approval off)
5. Creator **staff** row linked to their login (`user_id`), with departments `admin` + `management`
6. System **admin** role + all global permissions bound to that membership
7. Default organization preference if the user had none

Creating a **second** company repeats this structure independently. Data does not leak across companies; Inquiry Settings and queues are per-org.

### 4.3 Isolation rules

- Business tables carry `organization_id`
- Server always resolves `orgCode` → org UUID **for the current membership**, then queries by UUID
- Queries run inside `withTenantContext` so RLS sees `app.user_id`
- Membership insert is tightened: first join uses a security-definer function; arbitrary “join any org UUID” is blocked

---

## 5. Company home & departments

After selecting a company, the home screen is **Select Department** with tiles:

| Tile | Path | Status |
| --- | --- | --- |
| Staff | `/{code}/staff` | Built |
| Accounts | `/{code}/accounts` | Built (Inquiries + Invoice) |
| Reception | `/{code}/reception` | Built (Visitors + Vacation; timesheets are shells) |
| Sales | `/{code}/sales` | Built (Inquiries + Invoice) |
| Engineering Department | `/{code}/engineering` | Built (Inquiries + Invoice) |
| Admin | `/{code}/admin` | Built (full Inquiries CRM + Invoice) |
| All Logs | `/{code}/all-logs` | Built |
| Company Settings | `/{code}/company-settings` | Built |

Below the tiles, **My Tasks** shows pending vacation approvals for management.

Staff can also be tagged with assignable roles that are **not** home tiles: `management`, `workers` (plus the operational departments).

---

## 6. Modules in detail

### 6.1 Account / profile (`/settings`)

Personal to the logged-in user (not company-scoped):

- Name & email (synced with Company Settings **Admin name / email** for companies where the user is admin)
- Password change
- Login activity
- Personal salary & contract records

### 6.2 Company Settings

Two sections:

1. **Company profile** — company name, phones, WhatsApp, company email, website, Instagram, Facebook, and **Who is the Admin** (name/email linked to the admin user’s account).
2. **Inquiry Settings** — Excel-style grid of locked stages with:
   - **Stages** (fixed order; cannot reorder)
   - **Handled by Department** (Sales / Admin / Engineering / Accounts)
   - **Approval Required** (checkbox)
   - **Approval Required by** (Management or Engineering Department — enabled only when checked)
   - Vertical roadmap arrows between stage numbers

Saving the workflow map also **recomputes** `owningDepartmentKey` on open inquiries from each inquiry’s current stage. If the owning department changes, the assignee is cleared.

### 6.3 Staff

Org-scoped HR directory:

- Create / edit staff (name, contact, job title, status active/inactive, notes)
- Assign department roles (management, accounts, reception, sales, engineering, admin, workers)
- Salary & contract fields on the staff record
- Detail sections for vacation history, login activity placeholders, actions
- Optional link from staff → user login (`staff_members.user_id`) used for inquiry approvals

New company creators automatically get a linked Admin staff row so they can assign/approve immediately.

### 6.4 Reception

Sidebar sections:

| Section | Status |
| --- | --- |
| Vacation | Built — create leave requests for staff |
| Monthly Timesheet | Shell copy only |
| Daily Timesheet / OT | Shell copy only |
| Visitors | Built |

**Visitors** capture name, visit time, purpose, and notes.

Purposes include: inquiry, progress update, general visit, interview.

If purpose = **Inquiry**, the system creates a starter inquiry in the same transaction and links visitor ↔ inquiry both ways.

### 6.5 Vacation & My Tasks

- Leave types: annual, sick, emergency, other
- Selected weekdays + day count
- Status: pending → approved / rejected
- Company home My Tasks lets management approve/reject pending requests
- Reviews are reflected in All Logs

### 6.6 All Logs

Linear activity stream (`staff_activity_logs`) across the company — vacation reviews, staff create events, and related operational breadcrumbs. Category/action/summary oriented for a simple ops timeline.

### 6.7 Inquiry CRM (core pipeline)

This is the main commercial workflow.

#### Locked stage order

1. Inquiry  
2. Quotation  
3. LPO In or Out  
4. Proforma Invoice  
5. Job Card  
6. Progress Invoice  
7. Delivery Note  
8. Tax Invoice  
9. Receipt Voucher  

Stages only move **previous / next** (adjacent). No skipping.

#### Ownership & queues

- Each stage is mapped to a **handling department** in Inquiry Settings.
- The inquiry’s `owningDepartmentKey` follows the current stage’s mapping.
- **Admin → Inquiries** lists **all** company inquiries (full CRM + create).
- **Sales / Accounts / Engineering → Inquiries** list only inquiries owned by that department.
- **Invoice** tabs (Admin + those three depts) list inquiries that are both:
  - owned by that department, and
  - currently on an invoice stage: Proforma / Progress / Tax Invoice / Receipt Voucher.

#### Assignment gate

Until someone is assigned:

- Editing, commenting, approving, and stage moves are blocked
- UI shows a clear assign lock

Assignee must be an **active** staff member tagged with the inquiry’s current owning department.

When a stage move changes owning department, **assignee is cleared** (must re-assign in the new department).

#### Approvals

If Inquiry Settings marks the **current** stage as Approval Required:

- Next-stage is blocked until an approval row exists for that inquiry + stage
- Approver must be linked staff whose departments include **Management** or **Engineering Department** (matching “Approval Required by”)
- Approve records `inquiry_stage_approvals` and an activity event; it does **not** auto-advance the stage
- After approval, Next stage becomes available (still subject to assignment rules)

#### Inquiry detail UX

- Vertical workflow list on the left (current stage highlighted) + Previous / Next
- Main form: customer, contact, delivery date, quoted line items
- Notes as a **comment thread** under quoted items
- Right rail: assign person + activity log
- Approval banner when the current stage needs / has approval

#### Sources

- `admin` — created from Admin Inquiries
- `reception_visitor` — created from Reception Visitors (purpose Inquiry)

---

## 7. End-to-end flows

### 7.1 Reception inquiry handoff

```text
Reception → Visitors → Purpose: Inquiry (+ notes)
        │
        ▼
Starter inquiry created (stage = Inquiry, unassigned)
owning dept = Inquiry Settings mapping (default Admin)
        │
        ▼
Appears in that department’s Inquiries queue
(Admin always sees it in the full CRM list)
```

### 7.2 Work an inquiry

```text
Open inquiry → Assign staff in owning department
        │
        ▼
Edit details / line items / post Notes comments
        │
        ▼
If Approval Required on current stage → Approve (Management/Engineering)
        │
        ▼
Next stage → owning department may change → assignee cleared if so
        │
        ▼
When stage is an invoice stage → also appears on that dept’s Invoice tab
```

### 7.3 Multi-company day

```text
Login → pick / create company → department home
Create another company → independent settings, staff, inquiries, workflow
Profile name/email ↔ Admin contact stay linked for companies you admin
```

---

## 8. Security & tenancy model (summary)

- Session cookie after login; server actions call `requireSession()`
- Passwords hashed with bcrypt
- Successful logins recorded for profile “Login activity”
- RLS policies require org membership for tenant tables
- Peer display names for inquiry comments/actors use `app_member_display_name` (shared-org only; does not expose password hashes)
- Permission keys are seeded (`org.*`, `members.*`, `roles.*`, `staff.*`); membership + RLS currently gate most module access. Fine-grained permission checks on every action are a future RBAC hardening pass

---

## 9. Data model map (major tables)

| Area | Tables |
| --- | --- |
| Identity | `users`, `user_login_events`, `user_salary`, `user_contracts`, `user_preferences` |
| Tenancy / RBAC | `organizations`, `organization_settings`, `memberships`, `roles`, `permissions`, `role_permissions`, `membership_roles` |
| Staff | `staff_members` (+ optional `user_id`), `staff_department_assignments` |
| Reception / leave | `visitor_logs`, `vacation_requests` |
| Activity | `staff_activity_logs` |
| Inquiry CRM | `inquiry_workflow_settings`, `inquiries`, `inquiry_line_items`, `inquiry_stage_events`, `inquiry_comments`, `inquiry_stage_approvals` |

Schema source of truth: [`src/db/schema.ts`](src/db/schema.ts)  
RLS source of truth: [`src/db/rls.sql`](src/db/rls.sql)

---

## 10. Important code areas

| Concern | Location |
| --- | --- |
| Org create / list / default | `src/lib/org/` |
| Company + Inquiry Settings | `src/lib/company-settings/` |
| Inquiry stages & CRM | `src/lib/inquiries/` |
| Visitors | `src/lib/visitors/` |
| Staff / vacation / activity | `src/lib/staff/`, `src/lib/vacation/`, `src/lib/activity/` |
| Profile | `src/lib/profile/` |
| Department catalog | `src/lib/departments/catalog.ts` |
| App routes | `src/app/(app)/[orgCode]/...` |
| Migrations | `drizzle/0000_…` through `0012_…` |

---

## 11. Local run (brief)

See [`README.md`](README.md) for full setup. Short version:

```bash
npm install
npm run db:setup
npm run dev
```

Default seed login (first seed only creates; later seeds do not overwrite identity): `admin` / `admin`.

Env essentials:

- `DATABASE_URL` — app role (RLS applies)
- `DATABASE_URL_ADMIN` — migrate / seed
- `AUTH_SECRET` — session signing

---

## 12. What is intentionally not done yet

These are known shells or deferred scopes — not broken “missing wiring” of shipped features:

- Reception **Monthly / Daily timesheets** UI copy only
- Broad **permission-key enforcement** on every mutation (keys exist; membership/RLS do the heavy lifting today)
- Full staff↔login linking UI for every employee (creator is auto-linked; `user_id` exists for approvals)
- Public customer portal / external quote site
- Billing/payment gateways, email/WhatsApp senders, document PDF generation

---

## 13. Design principles the codebase tries to keep

1. **Company is the tenant** — never authorize from URL code alone.
2. **Modules are org-scoped** — new tables get `organization_id` + RLS in the same change.
3. **Inquiry stages are locked** — configuration changes ownership/approvals, not the pipeline order.
4. **Assignment before work** — assign unlocks edit / comments / approve / move.
5. **Settings should mean something** — Inquiry Settings drive queues, ownership, and approval gates.
6. **New companies replicate structure** — settings, workflow defaults, admin role, and creator staff bootstrap together.

---

## 14. One-sentence pitch

**AlJazayeh Internal System is a multi-company, RLS-secured 360° operations platform where reception, departments, and admin share one inquiry pipeline — configurable per company, assignable per stage, and approvable when management or engineering must sign off.**
