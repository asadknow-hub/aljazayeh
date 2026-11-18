import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { withTenantContext, type DbTransaction } from "@/db/client";
import {
  inquiries,
  inquiryComments,
  inquiryLineItems,
  inquiryStageApprovals,
  inquiryStageEvents,
  inquiryWorkflowSettings,
  staffDepartmentAssignments,
  staffMembers,
  visitorLogs,
} from "@/db/schema";
import { assertCan, can, type OrgAccess } from "@/lib/access/access";
import { UserError } from "@/lib/errors";
import {
  adjacentInquiryStages,
  defaultInquiryWorkflowMap,
  departmentForStage,
  INQUIRY_APPROVAL_ROLES,
  INQUIRY_STAGES,
  INVOICE_STAGE_KEYS,
  inquiryStageLabel,
  isInquiryApprovalRoleKey,
  isInquiryStageKey,
  isInquiryWorkflowDepartmentKey,
  type InquiryStageKey,
  type InquiryWorkflowDepartmentKey,
  type InquiryWorkflowMap,
} from "@/lib/inquiries/stages";
import type {
  InquiryActivityLogView,
  InquiryCommentView,
  InquiryCreateInput,
  InquiryUpdateInput,
  InquiryView,
} from "@/lib/inquiries/types";
import {
  normalizeInquiryCreateInput,
  normalizeInquiryWorkflowMap,
} from "@/lib/inquiries/validate";
import { requireOrg, resolveOrg, type ResolvedOrg } from "@/lib/org/resolve";
import { isUuid } from "@/lib/ids";

type InquiryRow = typeof inquiries.$inferSelect;

function stageOf(row: InquiryRow): InquiryStageKey {
  return isInquiryStageKey(row.currentStage) ? row.currentStage : "inquiry";
}

function ownerOf(row: InquiryRow): InquiryWorkflowDepartmentKey {
  return isInquiryWorkflowDepartmentKey(row.owningDepartmentKey)
    ? row.owningDepartmentKey
    : "admin";
}

function approvalRoleLabel(key: string): string {
  return INQUIRY_APPROVAL_ROLES.find((role) => role.key === key)?.label ?? key;
}

/* ------------------------------ workflow map ------------------------------ */

async function loadWorkflowMap(
  tx: DbTransaction,
  organizationId: string,
): Promise<InquiryWorkflowMap> {
  const rows = await tx
    .select()
    .from(inquiryWorkflowSettings)
    .where(eq(inquiryWorkflowSettings.organizationId, organizationId));

  // Stages without a saved row fall back to the defaults.
  const map = defaultInquiryWorkflowMap();
  for (const row of rows) {
    if (
      isInquiryStageKey(row.stageKey) &&
      isInquiryWorkflowDepartmentKey(row.departmentKey)
    ) {
      map[row.stageKey] = {
        departmentKey: row.departmentKey,
        approvalRequired: row.approvalRequired,
        approvalRequiredBy:
          row.approvalRequired &&
          isInquiryApprovalRoleKey(row.approvalRequiredBy)
            ? row.approvalRequiredBy
            : "",
      };
    }
  }
  return map;
}

export async function getInquiryWorkflowMapForUser(
  userId: string,
  orgCode: string,
): Promise<InquiryWorkflowMap | null> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.manageCompany(org.access)) return null;
    return loadWorkflowMap(tx, org.id);
  });
}

export async function saveInquiryWorkflowMapForUser(
  userId: string,
  orgCode: string,
  input: InquiryWorkflowMap,
): Promise<InquiryWorkflowMap> {
  const map = normalizeInquiryWorkflowMap(input);

  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    assertCan(can.manageCompany(org.access));
    const now = new Date();

    for (const stage of INQUIRY_STAGES) {
      const config = map[stage.key];
      await tx
        .insert(inquiryWorkflowSettings)
        .values({ organizationId: org.id, stageKey: stage.key, ...config })
        .onConflictDoUpdate({
          target: [
            inquiryWorkflowSettings.organizationId,
            inquiryWorkflowSettings.stageKey,
          ],
          set: { ...config, updatedAt: now },
        });
    }

    // Inquiries follow the department that now handles their stage. When
    // that changes, the old assignee no longer applies.
    const existing = await tx
      .select()
      .from(inquiries)
      .where(eq(inquiries.organizationId, org.id));

    for (const row of existing) {
      const owner = departmentForStage(map, stageOf(row));
      if (row.owningDepartmentKey === owner) continue;
      await tx
        .update(inquiries)
        .set({
          owningDepartmentKey: owner,
          assignedStaffId: null,
          updatedAt: now,
        })
        .where(eq(inquiries.id, row.id));
    }

    return map;
  });
}

/* --------------------------------- reading -------------------------------- */

async function loadLineItems(tx: DbTransaction, inquiryIds: string[]) {
  const byInquiry = new Map<string, InquiryView["lineItems"]>();
  if (inquiryIds.length === 0) return byInquiry;

  const rows = await tx
    .select()
    .from(inquiryLineItems)
    .where(inArray(inquiryLineItems.inquiryId, inquiryIds))
    .orderBy(asc(inquiryLineItems.sortOrder));

  for (const row of rows) {
    const list = byInquiry.get(row.inquiryId) ?? [];
    list.push({
      id: row.id,
      description: row.description,
      quantity: String(row.quantity),
      unitPrice: String(row.unitPrice),
      sortOrder: row.sortOrder,
    });
    byInquiry.set(row.inquiryId, list);
  }
  return byInquiry;
}

/** Display names for a set of users, one query per distinct user. */
async function loadDisplayNames(
  tx: DbTransaction,
  userIds: (string | null)[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const id of new Set(userIds)) {
    if (!id) continue;
    const rows = await tx.execute<{ name: string | null }>(
      sql`select app_member_display_name(${id}::uuid) as name`,
    );
    names.set(id, rows[0]?.name?.trim() || "Unknown user");
  }
  return names;
}

type InquiryDetails = Pick<
  InquiryView,
  | "createdByName"
  | "comments"
  | "activityLogs"
  | "approvalRequired"
  | "approvalRequiredBy"
  | "currentStageApproved"
  | "canApproveCurrentStage"
>;

const NO_DETAILS: InquiryDetails = {
  createdByName: "",
  comments: [],
  activityLogs: [],
  approvalRequired: false,
  approvalRequiredBy: "",
  currentStageApproved: false,
  canApproveCurrentStage: false,
};

function toInquiryView(
  row: InquiryRow,
  access: OrgAccess,
  lineItems: InquiryView["lineItems"],
  assignedStaffName: string | null,
  details: InquiryDetails = NO_DETAILS,
): InquiryView {
  const owner = ownerOf(row);
  return {
    id: row.id,
    organizationId: row.organizationId,
    customerName: row.customerName,
    contact: row.contact,
    deliveryExpectedOn: row.deliveryExpectedOn,
    notes: row.notes,
    currentStage: stageOf(row),
    owningDepartmentKey: owner,
    assignedStaffId: row.assignedStaffId,
    assignedStaffName,
    source: row.source === "reception_visitor" ? "reception_visitor" : "admin",
    sourceVisitorId: row.sourceVisitorId,
    createdByUserId: row.createdByUserId,
    canWork: can.workInquiry(access, owner),
    canAssign: can.assignInquiry(access, owner),
    lineItems,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...details,
  };
}

async function loadInquiryList(
  tx: DbTransaction,
  org: ResolvedOrg,
  filter: {
    department?: InquiryWorkflowDepartmentKey;
    stages?: readonly InquiryStageKey[];
  } = {},
): Promise<InquiryView[]> {
  const rows = await tx
    .select({ inquiry: inquiries, assignedName: staffMembers.fullName })
    .from(inquiries)
    .leftJoin(staffMembers, eq(staffMembers.id, inquiries.assignedStaffId))
    .where(
      and(
        eq(inquiries.organizationId, org.id),
        filter.department
          ? eq(inquiries.owningDepartmentKey, filter.department)
          : undefined,
        filter.stages
          ? inArray(inquiries.currentStage, [...filter.stages])
          : undefined,
      ),
    )
    .orderBy(desc(inquiries.updatedAt));

  const lineItems = await loadLineItems(
    tx,
    rows.map((row) => row.inquiry.id),
  );

  return rows.map((row) =>
    toInquiryView(
      row.inquiry,
      org.access,
      lineItems.get(row.inquiry.id) ?? [],
      row.assignedName,
    ),
  );
}

/** Every inquiry in the company: the Admin workspace. */
export async function listInquiriesForUser(
  userId: string,
  orgCode: string,
): Promise<InquiryView[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.viewAllInquiries(org.access)) return [];
    return loadInquiryList(tx, org);
  });
}

/** Inquiries whose current stage is handled by one department. */
export async function listInquiriesForDepartment(
  userId: string,
  orgCode: string,
  departmentKey: InquiryWorkflowDepartmentKey,
): Promise<InquiryView[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.openDepartment(org.access, departmentKey)) return [];
    return loadInquiryList(tx, org, { department: departmentKey });
  });
}

/** A department's inquiries that are currently at an invoicing stage. */
export async function listInvoiceQueueForUser(
  userId: string,
  orgCode: string,
  departmentKey: InquiryWorkflowDepartmentKey,
): Promise<InquiryView[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.openDepartment(org.access, departmentKey)) return [];
    return loadInquiryList(tx, org, {
      department: departmentKey,
      stages: INVOICE_STAGE_KEYS,
    });
  });
}

async function findInquiry(
  tx: DbTransaction,
  org: ResolvedOrg,
  inquiryId: string,
): Promise<InquiryRow | null> {
  if (!isUuid(inquiryId)) return null;
  const [row] = await tx
    .select()
    .from(inquiries)
    .where(
      and(eq(inquiries.id, inquiryId), eq(inquiries.organizationId, org.id)),
    )
    .limit(1);
  return row ?? null;
}

async function requireInquiry(
  tx: DbTransaction,
  org: ResolvedOrg,
  inquiryId: string,
): Promise<InquiryRow> {
  const row = await findInquiry(tx, org, inquiryId);
  if (!row || !can.viewInquiry(org.access, ownerOf(row))) {
    throw new UserError("Inquiry not found.");
  }
  return row;
}

async function hasApproval(
  tx: DbTransaction,
  inquiryId: string,
  stage: InquiryStageKey,
): Promise<boolean> {
  const [approval] = await tx
    .select({ id: inquiryStageApprovals.id })
    .from(inquiryStageApprovals)
    .where(
      and(
        eq(inquiryStageApprovals.inquiryId, inquiryId),
        eq(inquiryStageApprovals.stageKey, stage),
      ),
    )
    .limit(1);
  return Boolean(approval);
}

/** The full inquiry as shown on its page: comments, history, approval state. */
async function loadInquiryView(
  tx: DbTransaction,
  org: ResolvedOrg,
  row: InquiryRow,
): Promise<InquiryView> {
  const stage = stageOf(row);
  const config = (await loadWorkflowMap(tx, org.id))[stage];

  const commentRows = await tx
    .select()
    .from(inquiryComments)
    .where(eq(inquiryComments.inquiryId, row.id))
    .orderBy(asc(inquiryComments.createdAt));

  const eventRows = await tx
    .select()
    .from(inquiryStageEvents)
    .where(eq(inquiryStageEvents.inquiryId, row.id))
    .orderBy(asc(inquiryStageEvents.occurredAt));

  const names = await loadDisplayNames(tx, [
    row.createdByUserId,
    ...commentRows.map((comment) => comment.authorUserId),
    ...eventRows.map((event) => event.actorUserId),
  ]);
  const createdByName = names.get(row.createdByUserId) ?? "";

  const comments: InquiryCommentView[] = commentRows.map((comment) => ({
    id: comment.id,
    body: comment.body,
    authorUserId: comment.authorUserId,
    authorName: names.get(comment.authorUserId) ?? "",
    createdAt: comment.createdAt.toISOString(),
  }));

  const activityLogs: InquiryActivityLogView[] = [
    {
      id: `created-${row.id}`,
      label:
        row.source === "reception_visitor"
          ? "Created from Reception visitor"
          : "Created in Admin",
      detail: row.notes
        ? `Initial notes: ${row.notes}`
        : "Inquiry opened at Inquiry stage",
      actorName: createdByName,
      occurredAt: row.createdAt.toISOString(),
    },
    ...eventRows
      // The creation event is already represented by the entry above.
      .filter((event) => event.fromStage)
      .map((event) => ({
        id: event.id,
        // A stage move, or something that happened within a stage.
        label:
          event.fromStage === event.toStage
            ? event.note
            : `Moved ${inquiryStageLabel(event.fromStage)} → ${inquiryStageLabel(event.toStage)}`,
        detail:
          event.fromStage === event.toStage
            ? inquiryStageLabel(event.toStage)
            : event.note,
        actorName: event.actorUserId
          ? (names.get(event.actorUserId) ?? null)
          : null,
        occurredAt: event.occurredAt.toISOString(),
      })),
  ];

  const approvalRequired = config.approvalRequired;
  const currentStageApproved =
    approvalRequired && (await hasApproval(tx, row.id, stage));

  const [assigned] = row.assignedStaffId
    ? await tx
        .select({ fullName: staffMembers.fullName })
        .from(staffMembers)
        .where(eq(staffMembers.id, row.assignedStaffId))
        .limit(1)
    : [];
  const lineItems = await loadLineItems(tx, [row.id]);

  return toInquiryView(
    row,
    org.access,
    lineItems.get(row.id) ?? [],
    assigned?.fullName ?? null,
    {
      createdByName,
      comments,
      activityLogs,
      approvalRequired,
      approvalRequiredBy: config.approvalRequiredBy,
      currentStageApproved,
      canApproveCurrentStage:
        approvalRequired &&
        !currentStageApproved &&
        config.approvalRequiredBy !== "" &&
        org.access.departments.includes(config.approvalRequiredBy),
    },
  );
}

/** Re-read an inquiry after changing it and return the fresh view. */
async function reloadInquiryView(
  tx: DbTransaction,
  org: ResolvedOrg,
  inquiryId: string,
): Promise<InquiryView> {
  const row = await findInquiry(tx, org, inquiryId);
  if (!row) throw new UserError("Inquiry not found.");
  return loadInquiryView(tx, org, row);
}

export async function getInquiryForUser(
  userId: string,
  orgCode: string,
  inquiryId: string,
): Promise<InquiryView | null> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org) return null;
    const row = await findInquiry(tx, org, inquiryId);
    if (!row || !can.viewInquiry(org.access, ownerOf(row))) return null;
    return loadInquiryView(tx, org, row);
  });
}

/* --------------------------------- writing -------------------------------- */

/** Something that happened to an inquiry; a stage move when `to` differs. */
async function recordEvent(
  tx: DbTransaction,
  org: ResolvedOrg,
  userId: string,
  inquiryId: string,
  event: { from: InquiryStageKey | ""; to: InquiryStageKey; note?: string },
) {
  await tx.insert(inquiryStageEvents).values({
    organizationId: org.id,
    inquiryId,
    fromStage: event.from,
    toStage: event.to,
    actorUserId: userId,
    // Several events can be written in one transaction; keep their order.
    occurredAt: sql`clock_timestamp()`,
    note: event.note ?? "",
  });
}

/** An approval only covers what was approved; changes after it void it. */
async function clearApproval(
  tx: DbTransaction,
  org: ResolvedOrg,
  userId: string,
  inquiryId: string,
  stage: InquiryStageKey,
  reason: string,
) {
  const cleared = await tx
    .delete(inquiryStageApprovals)
    .where(
      and(
        eq(inquiryStageApprovals.inquiryId, inquiryId),
        eq(inquiryStageApprovals.stageKey, stage),
      ),
    )
    .returning({ id: inquiryStageApprovals.id });

  if (cleared.length > 0) {
    await recordEvent(tx, org, userId, inquiryId, {
      from: stage,
      to: stage,
      note: `Approval cleared: ${reason}`,
    });
  }
}

async function replaceLineItems(
  tx: DbTransaction,
  inquiryId: string,
  items: InquiryCreateInput["lineItems"],
) {
  await tx
    .delete(inquiryLineItems)
    .where(eq(inquiryLineItems.inquiryId, inquiryId));
  if (items.length === 0) return;

  await tx.insert(inquiryLineItems).values(
    items.map((item, index) => ({
      inquiryId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      sortOrder: index,
    })),
  );
}

async function insertInquiry(
  tx: DbTransaction,
  org: ResolvedOrg,
  userId: string,
  values: {
    customerName: string;
    contact?: string;
    deliveryExpectedOn?: string;
    notes: string;
    source: "admin" | "reception_visitor";
    sourceVisitorId?: string;
  },
): Promise<string> {
  const map = await loadWorkflowMap(tx, org.id);
  const id = crypto.randomUUID();

  await tx.insert(inquiries).values({
    id,
    organizationId: org.id,
    customerName: values.customerName,
    contact: values.contact ?? "",
    deliveryExpectedOn: values.deliveryExpectedOn ?? "",
    notes: values.notes,
    currentStage: "inquiry",
    owningDepartmentKey: departmentForStage(map, "inquiry"),
    source: values.source,
    sourceVisitorId: values.sourceVisitorId ?? null,
    createdByUserId: userId,
  });
  await recordEvent(tx, org, userId, id, { from: "", to: "inquiry" });

  return id;
}

export async function createInquiryForUser(
  userId: string,
  orgCode: string,
  input: InquiryCreateInput,
): Promise<InquiryView> {
  const normalized = normalizeInquiryCreateInput(input);

  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    assertCan(can.createInquiry(org.access));

    const id = await insertInquiry(tx, org, userId, {
      ...normalized,
      source: "admin",
    });
    await replaceLineItems(tx, id, normalized.lineItems);

    return reloadInquiryView(tx, org, id);
  });
}

/** A walk-in logged at Reception with purpose "Inquiry" starts an inquiry. */
export async function createStarterInquiryInTx(
  tx: DbTransaction,
  org: ResolvedOrg,
  userId: string,
  visitor: { id: string; fullName: string; notes: string },
): Promise<string> {
  const id = await insertInquiry(tx, org, userId, {
    customerName: visitor.fullName,
    notes: visitor.notes,
    source: "reception_visitor",
    sourceVisitorId: visitor.id,
  });

  await tx
    .update(visitorLogs)
    .set({ inquiryId: id, updatedAt: new Date() })
    .where(eq(visitorLogs.id, visitor.id));

  return id;
}

/** Load an inquiry the user is about to work on and check they may. */
async function requireWorkableInquiry(
  tx: DbTransaction,
  org: ResolvedOrg,
  inquiryId: string,
  unassignedMessage: string,
): Promise<InquiryRow> {
  const row = await requireInquiry(tx, org, inquiryId);
  assertCan(can.workInquiry(org.access, ownerOf(row)));
  if (!row.assignedStaffId) throw new UserError(unassignedMessage);
  return row;
}

export async function updateInquiryForUser(
  userId: string,
  orgCode: string,
  inquiryId: string,
  input: InquiryUpdateInput,
): Promise<InquiryView> {
  const normalized = normalizeInquiryCreateInput(input);

  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    const existing = await requireWorkableInquiry(
      tx,
      org,
      inquiryId,
      "Assign someone before editing this inquiry.",
    );

    await tx
      .update(inquiries)
      .set({
        customerName: normalized.customerName,
        contact: normalized.contact,
        deliveryExpectedOn: normalized.deliveryExpectedOn,
        updatedAt: new Date(),
      })
      .where(eq(inquiries.id, inquiryId));
    await replaceLineItems(tx, inquiryId, normalized.lineItems);
    await clearApproval(
      tx,
      org,
      userId,
      inquiryId,
      stageOf(existing),
      "inquiry changed",
    );

    return reloadInquiryView(tx, org, inquiryId);
  });
}

export async function addInquiryCommentForUser(
  userId: string,
  orgCode: string,
  inquiryId: string,
  body: string,
): Promise<InquiryView> {
  const text = body.trim();
  if (!text) {
    throw new UserError("Enter a comment.");
  }

  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    await requireWorkableInquiry(
      tx,
      org,
      inquiryId,
      "Assign someone before posting comments.",
    );

    await tx.insert(inquiryComments).values({
      organizationId: org.id,
      inquiryId,
      authorUserId: userId,
      body: text,
    });

    return reloadInquiryView(tx, org, inquiryId);
  });
}

/** Active staff of one department, for the "Assign person" list. */
export async function listAssignableStaffForDepartment(
  userId: string,
  orgCode: string,
  departmentKey: InquiryWorkflowDepartmentKey,
): Promise<{ id: string; fullName: string; jobTitle: string }[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.assignInquiry(org.access, departmentKey)) return [];
    return loadAssignableStaff(tx, org.id, departmentKey);
  });
}

async function loadAssignableStaff(
  tx: DbTransaction,
  organizationId: string,
  departmentKey: InquiryWorkflowDepartmentKey,
) {
  return tx
    .select({
      id: staffMembers.id,
      fullName: staffMembers.fullName,
      jobTitle: staffMembers.jobTitle,
    })
    .from(staffMembers)
    .innerJoin(
      staffDepartmentAssignments,
      and(
        eq(staffDepartmentAssignments.staffId, staffMembers.id),
        eq(staffDepartmentAssignments.departmentKey, departmentKey),
      ),
    )
    .where(
      and(
        eq(staffMembers.organizationId, organizationId),
        eq(staffMembers.status, "active"),
      ),
    )
    .orderBy(asc(staffMembers.fullName));
}

export async function assignInquiryForUser(
  userId: string,
  orgCode: string,
  inquiryId: string,
  staffId: string,
): Promise<InquiryView> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    const existing = await requireInquiry(tx, org, inquiryId);
    const owner = ownerOf(existing);
    assertCan(can.assignInquiry(org.access, owner));

    const assignee = (await loadAssignableStaff(tx, org.id, owner)).find(
      (staff) => staff.id === staffId,
    );
    if (!assignee) {
      throw new UserError(
        "Select an active staff member from this department.",
      );
    }

    await tx
      .update(inquiries)
      .set({ assignedStaffId: staffId, updatedAt: new Date() })
      .where(eq(inquiries.id, inquiryId));
    const stage = stageOf(existing);
    await recordEvent(tx, org, userId, inquiryId, {
      from: stage,
      to: stage,
      note: `Assigned to ${assignee.fullName}`,
    });

    return reloadInquiryView(tx, org, inquiryId);
  });
}

export async function approveInquiryStageForUser(
  userId: string,
  orgCode: string,
  inquiryId: string,
): Promise<InquiryView> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    const existing = await requireInquiry(tx, org, inquiryId);
    if (!existing.assignedStaffId) {
      throw new UserError("Assign a person before approving this stage.");
    }

    const stage = stageOf(existing);
    const config = (await loadWorkflowMap(tx, org.id))[stage];
    if (!config.approvalRequired || config.approvalRequiredBy === "") {
      throw new UserError("This stage does not require approval.");
    }
    const approver = approvalRoleLabel(config.approvalRequiredBy);
    if (!org.access.departments.includes(config.approvalRequiredBy)) {
      throw new UserError(`Only ${approver} can approve this stage.`);
    }
    if (await hasApproval(tx, inquiryId, stage)) {
      throw new UserError("This stage is already approved.");
    }

    await tx.insert(inquiryStageApprovals).values({
      organizationId: org.id,
      inquiryId,
      stageKey: stage,
      requiredBy: config.approvalRequiredBy,
      approvedByUserId: userId,
    });
    await recordEvent(tx, org, userId, inquiryId, {
      from: stage,
      to: stage,
      note: `Approved by ${approver}`,
    });

    return reloadInquiryView(tx, org, inquiryId);
  });
}

export async function moveInquiryStageForUser(
  userId: string,
  orgCode: string,
  inquiryId: string,
  direction: "previous" | "next",
): Promise<InquiryView> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    const existing = await requireWorkableInquiry(
      tx,
      org,
      inquiryId,
      "Assign a person before moving stages.",
    );

    const current = stageOf(existing);
    const toStage = adjacentInquiryStages(current)[direction];
    if (!toStage) {
      throw new UserError("No further stage in that direction.");
    }

    const map = await loadWorkflowMap(tx, org.id);
    if (direction === "next" && map[current].approvalRequired) {
      if (!(await hasApproval(tx, inquiryId, current))) {
        throw new UserError(
          `Approval required by ${approvalRoleLabel(map[current].approvalRequiredBy)} before moving to the next stage.`,
        );
      }
    }

    // Going back reopens the earlier stage, so it must be approved again.
    if (direction === "previous") {
      await clearApproval(tx, org, userId, inquiryId, toStage, "moved back");
    }

    const nextOwner = departmentForStage(map, toStage);
    await tx
      .update(inquiries)
      .set({
        currentStage: toStage,
        owningDepartmentKey: nextOwner,
        // A new department picks its own person.
        assignedStaffId:
          nextOwner === ownerOf(existing) ? existing.assignedStaffId : null,
        updatedAt: new Date(),
      })
      .where(eq(inquiries.id, inquiryId));
    await recordEvent(tx, org, userId, inquiryId, {
      from: current,
      to: toStage,
    });

    return reloadInquiryView(tx, org, inquiryId);
  });
}
