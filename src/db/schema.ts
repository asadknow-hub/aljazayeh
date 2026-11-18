import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  numeric,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

/*
 * Row Level Security.
 *
 * Every table carries its policies here so a table and its access rules are
 * always created by the same migration. Policies evaluate against the
 * request's `app.user_id` setting (see `withTenantContext`) through the SQL
 * helper functions created in drizzle/0000_access_functions.sql.
 */
type PolicyCheck = ReturnType<typeof sql.raw>;

const isSelf = (column: string) =>
  sql.raw(`${column} = app_current_user_id()`);

const isOrgMember = (column = "organization_id") =>
  sql.raw(`app_user_is_org_member(${column})`);

const isOrgAdmin = (column = "organization_id") =>
  sql.raw(`app_user_is_org_admin(${column})`);

const canManageStaff = (column = "organization_id") =>
  sql.raw(`app_user_can_manage_staff(${column})`);

/** For child tables that reach their company through a parent row. */
const viaParent = (
  parentTable: string,
  foreignKey: string,
  check = "app_user_is_org_member",
) =>
  sql.raw(
    `exists (select 1 from ${parentTable} p where p.id = ${foreignKey} and ${check}(p.organization_id))`,
  );

const allowSelect = (name: string, check: PolicyCheck) =>
  pgPolicy(name, { for: "select", using: check });
const allowInsert = (name: string, check: PolicyCheck) =>
  pgPolicy(name, { for: "insert", withCheck: check });
const allowUpdate = (name: string, check: PolicyCheck) =>
  pgPolicy(name, { for: "update", using: check, withCheck: check });
const allowDelete = (name: string, check: PolicyCheck) =>
  pgPolicy(name, { for: "delete", using: check });
const allowAll = (name: string, check: PolicyCheck) =>
  pgPolicy(name, { for: "all", using: check, withCheck: check });

/**
 * Members of the row's company may read, add and change rows; nobody deletes
 * them. Who may do what inside a company is decided in src/lib/access.
 */
const orgMemberRecords = (table: string) => [
  allowSelect(`${table}_member_select`, isOrgMember()),
  allowInsert(`${table}_member_insert`, isOrgMember()),
  allowUpdate(`${table}_member_update`, isOrgMember()),
];

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull(),
  fullName: text("full_name").notNull().default(""),
  email: text("email").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  /** May create companies. Everyone else only works inside companies they belong to. */
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  ...timestamps,
}, (table) => [
  uniqueIndex("users_username_uidx").on(table.username),
  allowSelect("users_self_select", isSelf("id")),
  allowUpdate("users_self_update", isSelf("id")),
]);

export const userLoginEvents = pgTable(
  "user_login_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address").notNull().default(""),
    userAgent: text("user_agent").notNull().default(""),
    success: boolean("success").notNull().default(true),
  },
  (table) => [
    index("user_login_events_user_occurred_idx").on(
      table.userId,
      table.occurredAt,
    ),
    // Rows are written by app_record_login() only.
    allowSelect("user_login_events_self_select", isSelf("user_id")),
  ],
);

/** Personal salary snapshot for the signed-in user. */
export const userSalary = pgTable("user_salary", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("AED"),
  payFrequency: text("pay_frequency").notNull().default("monthly"),
  effectiveFrom: text("effective_from").notNull().default(""),
  notes: text("notes").notNull().default(""),
  ...timestamps,
}, () => [allowAll("user_salary_self", isSelf("user_id"))]);

export const userContracts = pgTable(
  "user_contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    status: text("status").notNull().default("active"),
    startDate: text("start_date").notNull().default(""),
    endDate: text("end_date").notNull().default(""),
    notes: text("notes").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    index("user_contracts_user_idx").on(table.userId),
    allowAll("user_contracts_self", isSelf("user_id")),
  ],
);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("organizations_code_uidx").on(table.code),
  allowSelect("organizations_member_select", isOrgMember("id")),
  allowUpdate("organizations_admin_update", isOrgAdmin("id")),
  allowInsert(
    "organizations_platform_admin_insert",
    sql.raw("app_is_platform_admin()"),
  ),
]);

/** One settings profile per organization (company contact + public admin contact). */
export const organizationSettings = pgTable("organization_settings", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  telephoneNumber: text("telephone_number").notNull().default(""),
  phoneNumber: text("phone_number").notNull().default(""),
  whatsappNumber: text("whatsapp_number").notNull().default(""),
  email: text("email").notNull().default(""),
  websiteUrl: text("website_url").notNull().default(""),
  instagramUrl: text("instagram_url").notNull().default(""),
  facebookUrl: text("facebook_url").notNull().default(""),
  adminName: text("admin_name").notNull().default(""),
  adminEmail: text("admin_email").notNull().default(""),
  /** Printed under the monthly attendance sheet, one note per line. */
  attendanceSheetNotes: text("attendance_sheet_notes").notNull().default(""),
  ...timestamps,
}, () => [
  allowSelect("organization_settings_member_select", isOrgMember()),
  allowInsert("organization_settings_admin_insert", isOrgAdmin()),
  allowUpdate("organization_settings_admin_update", isOrgAdmin()),
]);

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  defaultOrganizationId: uuid("default_organization_id").references(
    () => organizations.id,
    { onDelete: "set null" },
  ),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, () => [
  allowAll("user_preferences_self", isSelf("user_id")),
]);

/**
 * Everyone who works for a company. A staff record with a linked login
 * (`userId`) and status "active" is what gives that person access to the
 * company; their departments decide what they can do in it.
 */
export const staffMembers = pgTable(
  "staff_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    fullName: text("full_name").notNull(),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    jobTitle: text("job_title").notNull().default(""),
    employeeCode: text("employee_code").notNull().default(""),
    /** First working day. Attendance before it shows as "New join". */
    joinedOn: date("joined_on", { mode: "string" }),
    status: text("status").notNull().default("active"),
    /** Company administrator: settings, staff logins, everything. */
    isAdmin: boolean("is_admin").notNull().default(false),
    notes: text("notes").notNull().default(""),
    salaryAmount: numeric("salary_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    salaryCurrency: text("salary_currency").notNull().default("AED"),
    payFrequency: text("pay_frequency").notNull().default("monthly"),
    lastSalaryPaidOn: text("last_salary_paid_on").notNull().default(""),
    salaryNotes: text("salary_notes").notNull().default(""),
    contractTitle: text("contract_title").notNull().default(""),
    contractStatus: text("contract_status").notNull().default("active"),
    contractStartDate: text("contract_start_date").notNull().default(""),
    contractEndDate: text("contract_end_date").notNull().default(""),
    contractNotes: text("contract_notes").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    index("staff_members_org_idx").on(table.organizationId),
    index("staff_members_org_name_idx").on(table.organizationId, table.fullName),
    uniqueIndex("staff_members_org_user_uidx").on(
      table.organizationId,
      table.userId,
    ),
    index("staff_members_user_idx").on(table.userId),
    allowSelect("staff_members_member_select", isOrgMember()),
    allowInsert("staff_members_manager_insert", canManageStaff()),
    allowUpdate("staff_members_manager_update", canManageStaff()),
    allowDelete("staff_members_manager_delete", canManageStaff()),
  ],
);

/** Many-to-many: staff ↔ fixed department keys from catalog. */
export const staffDepartmentAssignments = pgTable(
  "staff_department_assignments",
  {
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "cascade" }),
    departmentKey: text("department_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.staffId, table.departmentKey] }),
    index("staff_department_assignments_dept_idx").on(table.departmentKey),
    allowSelect(
      "staff_department_assignments_member_select",
      viaParent("staff_members", "staff_id"),
    ),
    allowInsert(
      "staff_department_assignments_manager_insert",
      viaParent("staff_members", "staff_id", "app_user_can_manage_staff"),
    ),
    allowDelete(
      "staff_department_assignments_manager_delete",
      viaParent("staff_members", "staff_id", "app_user_can_manage_staff"),
    ),
  ],
);

/** Vacation / leave requests initiated from Reception, approved by management. */
export const vacationRequests = pgTable(
  "vacation_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "cascade" }),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    /** JSON array of selected ISO dates (YYYY-MM-DD), weekdays typically. */
    selectedDates: text("selected_dates").notNull().default("[]"),
    dayCount: integer("day_count").notNull().default(0),
    leaveType: text("leave_type").notNull(),
    reason: text("reason").notNull().default(""),
    status: text("status").notNull().default("pending"),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    index("vacation_requests_org_idx").on(table.organizationId),
    index("vacation_requests_staff_idx").on(table.staffId),
    index("vacation_requests_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
    ...orgMemberRecords("vacation_requests"),
  ],
);

/** One mark per person per day, entered by Reception. */
export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "restrict" }),
    workDate: date("work_date", { mode: "string" }).notNull(),
    status: text("status").notNull(),
    markedByUserId: uuid("marked_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("attendance_records_staff_date_uidx").on(
      table.staffId,
      table.workDate,
    ),
    index("attendance_records_org_date_idx").on(
      table.organizationId,
      table.workDate,
    ),
    ...orgMemberRecords("attendance_records"),
    // A mark entered by mistake can be cleared.
    allowDelete("attendance_records_member_delete", isOrgMember()),
  ],
);

/** Reception visitor / call log. */
export const visitorLogs = pgTable(
  "visitor_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    visitedAt: timestamp("visited_at", { withTimezone: true }).notNull(),
    purpose: text("purpose").notNull(),
    notes: text("notes").notNull().default(""),
    inquiryId: uuid("inquiry_id").references((): AnyPgColumn => inquiries.id, {
      onDelete: "set null",
    }),
    loggedByUserId: uuid("logged_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    index("visitor_logs_org_idx").on(table.organizationId),
    index("visitor_logs_org_visited_idx").on(
      table.organizationId,
      table.visitedAt,
    ),
    ...orgMemberRecords("visitor_logs"),
  ],
);

/** Per-org mapping of inquiry stages → owning department. */
export const inquiryWorkflowSettings = pgTable(
  "inquiry_workflow_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stageKey: text("stage_key").notNull(),
    departmentKey: text("department_key").notNull().default("admin"),
    approvalRequired: boolean("approval_required").notNull().default(false),
    approvalRequiredBy: text("approval_required_by").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("inquiry_workflow_settings_org_stage_uidx").on(
      table.organizationId,
      table.stageKey,
    ),
    index("inquiry_workflow_settings_org_idx").on(table.organizationId),
    allowSelect("inquiry_workflow_settings_member_select", isOrgMember()),
    allowInsert("inquiry_workflow_settings_admin_insert", isOrgAdmin()),
    allowUpdate("inquiry_workflow_settings_admin_update", isOrgAdmin()),
  ],
);

/** CRM inquiry header. Always starts in Admin at stage inquiry. */
export const inquiries = pgTable(
  "inquiries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerName: text("customer_name").notNull(),
    contact: text("contact").notNull().default(""),
    deliveryExpectedOn: text("delivery_expected_on").notNull().default(""),
    notes: text("notes").notNull().default(""),
    currentStage: text("current_stage").notNull().default("inquiry"),
    owningDepartmentKey: text("owning_department_key").notNull().default("admin"),
    assignedStaffId: uuid("assigned_staff_id").references(() => staffMembers.id, {
      onDelete: "set null",
    }),
    source: text("source").notNull().default("admin"),
    sourceVisitorId: uuid("source_visitor_id").references(
      (): AnyPgColumn => visitorLogs.id,
      { onDelete: "set null" },
    ),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    index("inquiries_org_idx").on(table.organizationId),
    index("inquiries_org_stage_idx").on(table.organizationId, table.currentStage),
    index("inquiries_org_dept_idx").on(
      table.organizationId,
      table.owningDepartmentKey,
    ),
    ...orgMemberRecords("inquiries"),
  ],
);

/** Stage approvals required by Inquiry Settings before advancing. */
export const inquiryStageApprovals = pgTable(
  "inquiry_stage_approvals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    stageKey: text("stage_key").notNull(),
    requiredBy: text("required_by").notNull(),
    approvedByUserId: uuid("approved_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    approvedAt: timestamp("approved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("inquiry_stage_approvals_inquiry_stage_uidx").on(
      table.inquiryId,
      table.stageKey,
    ),
    index("inquiry_stage_approvals_org_idx").on(table.organizationId),
    index("inquiry_stage_approvals_inquiry_idx").on(table.inquiryId),
    allowSelect("inquiry_stage_approvals_member_select", isOrgMember()),
    allowInsert("inquiry_stage_approvals_member_insert", isOrgMember()),
    allowDelete("inquiry_stage_approvals_member_delete", isOrgMember()),
  ],
);

export const inquiryLineItems = pgTable(
  "inquiry_line_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    description: text("description").notNull().default(""),
    quantity: numeric("quantity", { precision: 14, scale: 2 })
      .notNull()
      .default("1"),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("inquiry_line_items_inquiry_idx").on(table.inquiryId),
    allowAll("inquiry_line_items_member_all", viaParent("inquiries", "inquiry_id")),
  ],
);

export const inquiryStageEvents = pgTable(
  "inquiry_stage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    fromStage: text("from_stage").notNull().default(""),
    toStage: text("to_stage").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    note: text("note").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    index("inquiry_stage_events_inquiry_idx").on(table.inquiryId),
    index("inquiry_stage_events_org_idx").on(table.organizationId),
    allowSelect("inquiry_stage_events_member_select", isOrgMember()),
    allowInsert("inquiry_stage_events_member_insert", isOrgMember()),
  ],
);

/** Threaded work notes on an inquiry. */
export const inquiryComments = pgTable(
  "inquiry_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    ...timestamps,
  },
  (table) => [
    index("inquiry_comments_inquiry_idx").on(table.inquiryId),
    index("inquiry_comments_org_idx").on(table.organizationId),
    allowSelect("inquiry_comments_member_select", isOrgMember()),
    allowInsert("inquiry_comments_member_insert", isOrgMember()),
  ],
);

/** Linear activity stream for staff actions across departments. */
export const staffActivityLogs = pgTable(
  "staff_activity_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    category: text("category").notNull(),
    action: text("action").notNull(),
    summary: text("summary").notNull(),
    details: text("details").notNull().default(""),
    status: text("status").notNull().default(""),
    dayCount: integer("day_count").notNull().default(0),
    referenceType: text("reference_type").notNull().default(""),
    referenceId: text("reference_id").notNull().default(""),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("staff_activity_logs_org_idx").on(table.organizationId),
    index("staff_activity_logs_org_occurred_idx").on(
      table.organizationId,
      table.occurredAt,
    ),
    index("staff_activity_logs_staff_idx").on(table.staffId),
    // Audit trail: append-only.
    allowSelect("staff_activity_logs_member_select", isOrgMember()),
    allowInsert("staff_activity_logs_member_insert", isOrgMember()),
  ],
);

export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Inquiry = typeof inquiries.$inferSelect;

