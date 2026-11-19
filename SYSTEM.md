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
| Sales / Engineering / Accounts | The inquiries whose current step they handle |
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
| Company settings, inquiry settings, signatories, creating logins, making administrators | Company administrator |
| Staff directory incl. salary and contracts, All Logs | Administrator, Management |
| Reception (visitors, raising leave requests) | Administrator, Management, Reception |
| Signing a leave request | The holder of each signing position, in order |
| A department workspace (Admin, Sales, Accounts, Engineering) | That department, Administrator, Management |
| Seeing every inquiry | Administrator, Management, Admin department |
| Working an inquiry (fill in, move on, send back) | The department that handles its current step, Administrator |
| Assigning an inquiry | Owning department, Administrator, Management |
| Approving a stage | Whoever Inquiry Settings names (Management or Engineering) |

The company home only shows the tiles a person can open; other pages return 404 for them.

### 4.3 Creating a company

The owner creates a company, which bootstraps:

1. The organization row
2. The creator as its first staff member: administrator, in Admin and Management
3. `organization_settings` with the creator as contact
4. Default inquiry workflow rows (invoices and the receipt → Accounts, every other step → Admin, approval off)
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
| Accounts | `/{code}/accounts` | Built (Inquiries, Petty cash) |
| Reception | `/{code}/reception` | Built (Attendance, Vacation, Visitors) |
| Sales | `/{code}/sales` | Built (Inquiries) |
| Engineering Department | `/{code}/engineering` | Built (Inquiries, Material requests) |
| Admin | `/{code}/admin` | Built (all Inquiries, Verbal work approvals) |
| All Logs | `/{code}/all-logs` | Built |
| Company Settings | `/{code}/company-settings` | Built |

Each person sees only the tiles they may open. Below them, **My Tasks** lists the documents
waiting for that person's signature.

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

- Create / edit staff (name, contact, profession, status active/inactive, notes)
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

### 6.5 Leave requests, signatures and My Tasks

Built from the company's paper "Leave Request Application".

- Reception raises a request for an employee: first and last day, type, reason, and the optional
  office-use fields. The employee's details (designation, contacts, passport, joining date) come
  from their staff record; day count, return date, working duration and last return are worked out.
- The request is a **form** (`/{code}/leave/{id}`) laid out like the paper one. What is on screen
  is what prints: two A4 pages with the letterhead.
- It is **signed in order**: Prepared By (whoever raised it), Foreman, Accountant, CEO & Managing
  Partner, Managing Director. Each signer sees it under **My Tasks** on the company home when it
  is their turn, opens it, and approves or rejects with their **approval PIN**. Approving stamps
  their saved signature, name and the date into their box. A rejection needs a reason and ends
  the request.
- When the last box is signed the leave is approved and shows as VACATION on the attendance sheet.
- Workers have no login; the "Signature of Employee" box is signed on the printed form.

**Signatures and PIN** — each person saves their signature once under Account → Signature (drawn
on screen or uploaded) and chooses a 4–6 digit PIN. Five wrong PINs lock it until a new one is
set. A signed form keeps the signature as it was at signing.

**Signatories** — Company Settings → Signatories says who holds each signing position (Admin,
Foreman, Purchaser, Accountant, CEO & Managing Partner, Managing Director). The chain of each
document type is defined in [`src/lib/signoffs/chains.ts`](src/lib/signoffs/chains.ts); adding a
form to the system means adding its chain there.

### 6.5a Signed internal forms

Five more of the company's paper forms use the same sign-off mechanism as leave requests:

| Form | Raised in | Signed by, in order |
| --- | --- | --- |
| Fine Notice | Reception | Admin, Accounts, Managing Partner, Managing Director |
| Medical Amount (company pays 70%, employee 30%) | Reception | Accounts, Managing Partner, Managing Director |
| Petty Cash Form | Accounts workspace | Prepared By, Accounts, Managing Partner, Managing Director |
| Material Request Approval Form | Engineering workspace | Foreman, Purchaser, Accounts, Managing Partner, Managing Director |
| Verbal Work Approval Form (adds 5% VAT) | Admin workspace | Foreman, Purchaser, Accounts, Managing Partner, Managing Director |

Each gets a running reference number per year (`AJE/FN/2026/0001`), appears under My Tasks for
whoever signs next, and prints like its paper version at `/{code}/forms/{id}`. Forms about an
employee leave a box for that employee to sign on the printed copy.

A form is **defined, not programmed**: what it asks is in
[`src/lib/forms/definitions.ts`](src/lib/forms/definitions.ts), what it prints in
[`src/lib/forms/print.ts`](src/lib/forms/print.ts) and who signs in
[`src/lib/signoffs/chains.ts`](src/lib/signoffs/chains.ts). Entering, numbering, signing and
access are shared. Adding a form of this kind for another company means adding those three entries.

### 6.6 All Logs

Linear activity stream (`staff_activity_logs`) across the company — vacation reviews, staff create events, and related operational breadcrumbs. Category/action/summary oriented for a simple ops timeline.

### 6.7 Inquiries (the core process)

An inquiry is one job, followed from the customer's first request to the
money being received. The company runs on it: work starts here, and every
commercial paper is prepared in one of its steps by the department
responsible for it.

#### The steps and their papers

| # | Step | Papers prepared in it | Numbers |
| --- | --- | --- | --- |
| 1 | Inquiry | none: the customer's details and the items with quantity and price | `AJE/INQ/2026/0001` |
| 2 | Quotation | Quotation (Commercial Quotation for an export job), two pages | `AJE/QTN/…` |
| 3 | LPO In or Out | the customer's LPO is recorded (in); Purchase Order to a supplier when material must be bought (out) | `AJE/PO/…` |
| 4 | Proforma Invoice | Proforma Invoice | `AJE/PI/…` |
| 5 | Job Card | Job Card; Certificate of Compliance and Coating Certificate when the job needs them | `AJE/JC/…`, `AJE/COC/…`, `AJE/CC/…` |
| 6 | Progress Invoice | Progress Invoice | `AJE/PRG/…` |
| 7 | Delivery Note | Delivery Note | `AJE/DN/…` |
| 8 | Tax Invoice | Tax Invoice | `AJE/INV/…` |
| 9 | Commercial Invoice (export jobs only) | Commercial Invoice; Packing List when needed | `AJE/CI/…`, `AJE/PL/…` |
| 9 / 10 | Receipt Voucher | Receipt Voucher; closes the inquiry | `AJE/RV/…` |

A local job has nine steps. An export job has the Commercial Invoice as
step 9 and the Receipt Voucher as step 10.

- Each step shows its paper as it prints, laid out like the company's own
  form. What the form says is written by hand is typed straight onto the
  paper (the yellow places); everything else is filled in from the earlier
  steps: customer details, items, prices, and the numbers of the quotation,
  LPO, job card and delivery note.
- A paper gets its number the first time its step is saved with that paper in
  use. **Print** prints the paper that is on screen and nothing else.
- Which papers a step has, what is typed on them and what is required is in
  `src/lib/inquiries/stage-forms.ts`. How each paper looks is in
  `src/components/inquiries/papers.tsx`.
- The items are listed with quantity and price on the Inquiry, given units
  and final prices on the Quotation, and ticked off on the Delivery Note.
  Other steps only add their own details to an item (a remark, a heat
  number, an HS code), so the invoice always matches the quote.
- The company's address, TRN and bank details printed on the papers are
  entered once under Company Settings.

#### Working a step

- Each step is handled by the department chosen in Inquiry Settings.
- Nothing can be done on a step until someone from that department is
  assigned to it.
- **Save** keeps the step as it is. **Save & Go to Next Step** also finishes
  it, and hands the inquiry to the next step's department **unassigned**.
  **Discard** drops unsaved changes.
- If something required is missing, the step does not move: the missing
  places are marked in red and the first one is brought into view.
- **Send back to the previous step** needs a reason. The earlier step goes
  back to the person who handled it, and must be approved again.
- An inquiry that is not going ahead is **closed as lost** with a reason and
  can be reopened. Completing the last step marks it completed.

#### Who sees what

- **Admin → Inquiries** lists every inquiry and creates new ones.
- **Sales / Accounts / Engineering → Inquiries** list the ones whose current
  step they handle.
- Finished steps can be opened to read; steps not reached yet are locked.
- The list shows how many open inquiries sit at each step, filters (mine,
  not assigned, open / completed / lost), search, and assigning straight from
  the list.
- Inquiries assigned to a person, and steps waiting for their approval, are
  on their home screen under My Tasks.

#### Approvals

If Inquiry Settings marks a step as needing approval:

- It cannot move on until Management or Engineering (whichever is named)
  approves it. Whoever must approve can open the inquiry.
- A step with required answers missing cannot be approved.
- Changing the step after approval voids the approval; saving it unchanged
  does not.

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
Open inquiry → assign someone from the step's department
        │
        ▼
Fill in the step (Save as often as needed)
        │
        ▼
If the step needs approval → Management / Engineering approves
        │
        ▼
Save & Go to Next Step → next department, nobody assigned yet
        │
        ▼
… until the Receipt Voucher, which completes the inquiry
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
| Sign-offs | `signatory_positions`, `document_signoffs` (append-only) |
| Signed forms | `approval_forms`, `document_counters` (running numbers) |
| Activity | `staff_activity_logs` |
| Inquiry CRM | `inquiry_workflow_settings`, `inquiries`, `inquiry_stage_records`, `inquiry_line_items`, `inquiry_stage_events`, `inquiry_comments`, `inquiry_stage_approvals` |

Schema and RLS policies: [`src/db/schema.ts`](src/db/schema.ts)  
SQL access functions: [`drizzle/0000_access_functions.sql`](drizzle/0000_access_functions.sql)

---

## 10. Important code areas

| Concern | Location |
| --- | --- |
| Org create / list / default | `src/lib/org/` |
| Company + Inquiry Settings | `src/lib/company-settings/` |
| Inquiries: the steps and their rules | `src/lib/inquiries/` |
| What each inquiry step asks | `src/lib/inquiries/stage-forms.ts` |
| Look of the screens (buttons, fields, cards, colours) | `src/app/globals.css`, `src/lib/departments/colors.ts` |
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

- Customers as records (TRN, address, credit limit) shared between inquiries. Today they are
  typed on each inquiry, and the credit summary on the tax invoice is typed by Accounts.
- The proforma invoice, progress invoice and receipt voucher follow the tax invoice's layout
  until the company's own forms for them are provided.
- Signatures and the stamp on customer documents are put on by hand after printing.
- Per-company workflows: the nine steps are the same for every company.
- Labour card (daily in/out, overtime and the monthly pay summary).
- Personal Salary / Contract under Account duplicate the HR record and will be replaced by a
  read-only view of it.
- Ending other sessions when a password changes.
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
