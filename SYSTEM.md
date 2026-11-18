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
| Owner | Creates companies |
| Company administrator | Company Settings, Inquiry Settings, staff logins, everything in the company |
| Reception | Daily attendance and the monthly attendance sheet, visitors log, vacation requests |
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
Row Level Security (RLS)    ── company isolation + escalation guards
```

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 |
| Database | PostgreSQL |
| ORM / migrations | Drizzle + SQL under `drizzle/` |
| Auth | Cookie session (`aj_session`) + bcrypt password hashes |
| Tenancy | `organizations.id` (UUID) + human URL `/{ORG_CODE}` |
| App DB role | Non-owner login role (member of `aljazayeh_app`) so RLS applies |

Canonical contract for new modules: [`src/db/DEPARTMENT_CONTRACT.md`](src/db/DEPARTMENT_CONTRACT.md).

---

## 4. Companies, staff and access

### 4.1 Concepts

- **Company (organization)** — the tenant. UUID primary key; a human-facing **code** in the URL.
- **Staff member** — everyone who works for a company. HR data lives here.
- **Login (user)** — optional, linked to a staff member. A person can use a company when they have
  an **active staff record with a login** there. Setting them to Inactive cuts access at once.
- **Departments** — tags on the staff record (Management, Accounts, Reception, Sales, Engineering,
  Admin, Workers). They decide what the person can open and do.
- **Company administrator** — a flag on the staff record: company settings, workflow settings, logins.
- **Owner** — the platform-admin login. The only one that can create companies.

URL shape:

```text
/{orgCode}/admin
/{orgCode}/reception
/{orgCode}/company-settings
/settings          ← personal account (not under a company)
/login
```

Org codes are normalized lowercase (`a-z`, `0-9`, single hyphens). Reserved codes (e.g. `login`,
`settings`, `admin`, `api`) cannot be company codes.

### 4.2 Who can do what

All rules are in [`src/lib/access/access.ts`](src/lib/access/access.ts).

| Area | Who |
| --- | --- |
| Company settings, inquiry settings, creating logins, making administrators | Company administrator |
| Staff directory incl. salary and contracts, All Logs | Administrator, Management |
| Reception (visitors, raising leave requests) | Administrator, Management, Reception |
| Approving / rejecting leave | Administrator, Management |
| A department workspace (Admin, Sales, Accounts, Engineering) | That department, Administrator, Management |
| Seeing every inquiry | Administrator, Management, Admin department |
| Working an inquiry (edit, comment, move) | The department that owns its current stage, Administrator |
| Assigning an inquiry | Owning department, Administrator, Management |
| Approving a stage | Whoever Inquiry Settings names (Management or Engineering) |

The company home only shows the tiles a person can open; other pages return 404 for them.

### 4.3 Creating a company

The owner creates a company, which bootstraps:

1. The organization row
2. The creator as its first staff member: administrator, in Admin and Management
3. `organization_settings` with the creator as contact
4. Default inquiry workflow rows (every stage → Admin, approval off)
5. Default-company preference if the user had none

A second company repeats this independently; nothing is shared between companies.

### 4.4 Giving someone access

Staff → open the person → **Login** → choose a username and first password. An administrator can
reset the password or make the person an administrator from the same place. People change their own
password under Account.

---

## 5. Company home & departments

After selecting a company, the home screen is **Select Department** with tiles:

| Tile | Path | Status |
| --- | --- | --- |
| Staff | `/{code}/staff` | Built |
| Accounts | `/{code}/accounts` | Built (Inquiries + Invoice) |
| Reception | `/{code}/reception` | Built (Attendance, Vacation, Visitors) |
| Sales | `/{code}/sales` | Built (Inquiries + Invoice) |
| Engineering Department | `/{code}/engineering` | Built (Inquiries + Invoice) |
| Admin | `/{code}/admin` | Built (full Inquiries CRM + Invoice) |
| All Logs | `/{code}/all-logs` | Built |
| Company Settings | `/{code}/company-settings` | Built |

Each person sees only the tiles they may open. Below them, **My Tasks** shows pending vacation
approvals to Management and administrators.

Staff can also be tagged with assignable roles that are **not** home tiles: `management`, `workers` (plus the operational departments).

---

## 6. Modules in detail

### 6.1 Account / profile (`/settings`)

Personal to the logged-in user (not company-scoped):

- Name & email
- Password change
- Login activity
- Personal salary & contract records

### 6.2 Company Settings

Two sections:

1. **Company profile** — company name, phones, WhatsApp, company email, website, Instagram, Facebook, and **Who is the Admin** (the main contact person).
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
- Detail sections for vacation history, login and actions
- **Login** tab: give the person a username and password, reset it, or make them an administrator

New company creators automatically get a linked Admin staff row so they can assign/approve immediately.

### 6.4 Reception

Sidebar sections:

| Section | Status |
| --- | --- |
| Attendance | Built — daily marking and the printable monthly sheet |
| Vacation | Built — create leave requests for staff |
| Visitors | Built |

**Attendance** follows the company's paper "Employee Attendance Sheet". Reception marks each
person once a day: P (present), A (absent), HF (half day), MD or OFF (Friday is the weekly day
off). "Mark the rest Present" fills in everyone not marked yet. Two things fill in on their own:
approved leave shows as VACATION, and days before a person's joining date show as NEW JOIN.

The **monthly sheet** (`/{code}/reception/attendance`) is laid out like the paper form, one for
Workers and one for Office staff, and prints on one A4 landscape page. Totals count P, OFF and MD
as present days; A, vacation and days before joining as absent days; half days separately. Notes
printed under the sheet are set in Company Settings → Printed forms.

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

## 8. Security model (summary)

- Session cookie after login; passwords hashed with bcrypt, minimum 8 characters.
- Every server query resolves the company from the URL **for the signed-in user** and checks a rule
  from `src/lib/access/access.ts` before reading or changing anything.
- Row Level Security is the backstop underneath: it keeps companies apart, makes the audit trail
  append-only, and restricts staff records, company settings and workflow settings to the people
  allowed to change them, even for direct database access with the app's role.
- `users` rows are readable and writable only by their owner; logins for others are created and
  reset through database functions that check the caller is that company's administrator.
- A company administrator cannot reset the owner's password.
- People with history are deactivated, never deleted, so records that refer to them stay intact.
- `tests/access.test.ts` exercises these rules against a real database on every CI run.

Known gaps, planned for the deployment-hardening pass: login attempt throttling, and ending other
sessions when a password changes (sessions currently last 12 hours).

---

## 9. Data model map (major tables)

| Area | Tables |
| --- | --- |
| Identity | `users`, `user_login_events`, `user_salary`, `user_contracts`, `user_preferences` |
| Company | `organizations`, `organization_settings` |
| Staff and access | `staff_members` (login link, administrator flag), `staff_department_assignments` |
| Reception / leave | `attendance_records`, `visitor_logs`, `vacation_requests` |
| Activity | `staff_activity_logs` |
| Inquiry CRM | `inquiry_workflow_settings`, `inquiries`, `inquiry_line_items`, `inquiry_stage_events`, `inquiry_comments`, `inquiry_stage_approvals` |

Schema and RLS policies: [`src/db/schema.ts`](src/db/schema.ts)  
SQL access functions: [`drizzle/0000_access_functions.sql`](drizzle/0000_access_functions.sql)

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
| Department workspaces (Admin, Sales, Accounts, Engineering) | `src/app/(app)/[orgCode]/[dept]/` |
| App routes | `src/app/(app)/[orgCode]/...` |
| Migrations | `drizzle/` (generated from the schema) |

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

- Documents behind the pipeline stages (quotation, LPO, job card, delivery note, invoices, receipt)
  with numbering, VAT and printing. Stages are status only today.
- Per-company workflows: the nine stages are the same for every company.
- Labour card (daily in/out, overtime and the monthly pay summary), the full leave application
  form with its sign-offs, and employee notices / fines.
- Personal Salary / Contract under Account duplicate the HR record and will be replaced by a
  read-only view of it.
- Login throttling and session revocation (see section 8).
- Email / WhatsApp sending, file attachments.

---

## 13. Design principles the codebase tries to keep

1. **Company is the tenant** — never authorize from URL code alone.
2. **Modules are org-scoped** — new tables get `organization_id` + RLS in the same change.
3. **Inquiry stages are locked** — configuration changes ownership/approvals, not the pipeline order.
4. **Assignment before work** — assign unlocks edit / comments / approve / move.
5. **Settings should mean something** — Inquiry Settings drive queues, ownership, and approval gates.
6. **New companies replicate structure** — settings, workflow defaults and the creator as administrator bootstrap together.

---

## 14. One-sentence pitch

**AlJazayeh Internal System is a multi-company, RLS-secured 360° operations platform where reception, departments, and admin share one inquiry pipeline — configurable per company, assignable per stage, and approvable when management or engineering must sign off.**
