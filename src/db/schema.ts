import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  numeric,
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

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull(),
  fullName: text("full_name").notNull().default(""),
  email: text("email").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
}, (table) => [
  uniqueIndex("users_username_uidx").on(table.username),
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
});

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
  (table) => [index("user_contracts_user_idx").on(table.userId)],
);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("organizations_code_uidx").on(table.code),
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
  ...timestamps,
});

export const memberships = pgTable("memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ...timestamps,
}, (table) => [
  uniqueIndex("memberships_user_org_uidx").on(
    table.userId,
    table.organizationId,
  ),
  index("memberships_org_idx").on(table.organizationId),
  index("memberships_user_idx").on(table.userId),
]);

export const permissions = pgTable("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull(),
  description: text("description").notNull().default(""),
  ...timestamps,
}, (table) => [
  uniqueIndex("permissions_key_uidx").on(table.key),
]);

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  name: text("name").notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  ...timestamps,
}, (table) => [
  uniqueIndex("roles_org_key_uidx").on(table.organizationId, table.key),
  index("roles_org_idx").on(table.organizationId),
]);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionId] }),
  ],
);

export const membershipRoles = pgTable(
  "membership_roles",
  {
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.membershipId, table.roleId] }),
  ],
);

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
});

/** Org-scoped staff directory (HR module). */
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
    status: text("status").notNull().default("active"),
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
  (table) => [index("inquiry_line_items_inquiry_idx").on(table.inquiryId)],
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
  ],
);

export type User = typeof users.$inferSelect;
export type UserLoginEvent = typeof userLoginEvents.$inferSelect;
export type UserSalary = typeof userSalary.$inferSelect;
export type UserContract = typeof userContracts.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type OrganizationSettings = typeof organizationSettings.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type StaffMember = typeof staffMembers.$inferSelect;
export type StaffDepartmentAssignment =
  typeof staffDepartmentAssignments.$inferSelect;
export type VacationRequest = typeof vacationRequests.$inferSelect;
export type VisitorLog = typeof visitorLogs.$inferSelect;
export type StaffActivityLog = typeof staffActivityLogs.$inferSelect;
export type InquiryWorkflowSetting = typeof inquiryWorkflowSettings.$inferSelect;
export type Inquiry = typeof inquiries.$inferSelect;
export type InquiryLineItem = typeof inquiryLineItems.$inferSelect;
export type InquiryStageEvent = typeof inquiryStageEvents.$inferSelect;
export type InquiryComment = typeof inquiryComments.$inferSelect;
export type InquiryStageApproval = typeof inquiryStageApprovals.$inferSelect;

/** Helper expression for SQL migrations / docs */
export const currentAppUserId = sql`nullif(current_setting('app.user_id', true), '')::uuid`;
