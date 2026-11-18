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
  memberships,
  organizations,
  staffDepartmentAssignments,
  staffMembers,
  users,
  visitorLogs,
} from "@/db/schema";
import { userIsOrgAdmin } from "@/lib/company-settings/admin-contact";
import {
  defaultInquiryWorkflowMap,
  departmentForStage,
  INQUIRY_STAGES,
  INVOICE_STAGE_KEYS,
  inquiryStageLabel,
  isInquiryApprovalRoleKey,
  isInquiryStageKey,
  isInquiryWorkflowDepartmentKey,
  type InquiryApprovalRoleKey,
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
  assertAdjacentStageMove,
  normalizeInquiryCreateInput,
  normalizeInquiryWorkflowMap,
} from "@/lib/inquiries/validate";
import { normalizeOrgCode } from "@/lib/org/code";

async function resolveOrgId(
  tx: DbTransaction,
  userId: string,
  orgCode: string,
) {
  const code = normalizeOrgCode(orgCode);
  const [org] = await tx
    .select({ id: organizations.id, code: organizations.code })
    .from(organizations)
    .innerJoin(
      memberships,
      and(
        eq(memberships.organizationId, organizations.id),
        eq(memberships.userId, userId),
      ),
    )
    .where(eq(organizations.code, code))
    .limit(1);

  return org ?? null;
}

async function ensureWorkflowRows(tx: DbTransaction, organizationId: string) {
  const existing = await tx
    .select()
    .from(inquiryWorkflowSettings)
    .where(eq(inquiryWorkflowSettings.organizationId, organizationId));

  const have = new Set(existing.map((row) => row.stageKey));
  const missing = INQUIRY_STAGES.filter((stage) => !have.has(stage.key));
  if (missing.length === 0) return;

  const now = new Date();
  await tx.insert(inquiryWorkflowSettings).values(
    missing.map((stage) => ({
      id: crypto.randomUUID(),
      organizationId,
      stageKey: stage.key,
      departmentKey: "admin",
      approvalRequired: false,
      approvalRequiredBy: "",
      createdAt: now,
      updatedAt: now,
    })),
  );
}

async function loadWorkflowMap(
  tx: DbTransaction,
  organizationId: string,
): Promise<InquiryWorkflowMap> {
  await ensureWorkflowRows(tx, organizationId);
  const rows = await tx
    .select()
    .from(inquiryWorkflowSettings)
    .where(eq(inquiryWorkflowSettings.organizationId, organizationId));

  const map = defaultInquiryWorkflowMap();
  for (const row of rows) {
    if (
      isInquiryStageKey(row.stageKey) &&
      isInquiryWorkflowDepartmentKey(row.departmentKey)
    ) {
      map[row.stageKey] = {
        departmentKey: row.departmentKey,
        approvalRequired: Boolean(row.approvalRequired),
        approvalRequiredBy:
          row.approvalRequired && isInquiryApprovalRoleKey(row.approvalRequiredBy)
            ? row.approvalRequiredBy
            : "",
      };
    }
  }
  return map;
}

async function displayNameForUser(
  tx: DbTransaction,
  userId: string,
): Promise<string> {
  const rows = await tx.execute<{ name: string }>(sql`
    select coalesce(app_member_display_name(${userId}::uuid), '') as name
  `);
  const name = rows[0]?.name?.trim() ?? "";
  return name || "Unknown user";
}

async function linkedStaffDepartmentKeys(
  tx: DbTransaction,
  organizationId: string,
  userId: string,
): Promise<string[]> {
  const rows = await tx
    .select({ departmentKey: staffDepartmentAssignments.departmentKey })
    .from(staffMembers)
    .innerJoin(
      staffDepartmentAssignments,
      eq(staffDepartmentAssignments.staffId, staffMembers.id),
    )
    .where(
      and(
        eq(staffMembers.organizationId, organizationId),
        eq(staffMembers.userId, userId),
        eq(staffMembers.status, "active"),
      ),
    );
  return rows.map((row) => row.departmentKey);
}

async function ensureLinkedApproverStaff(
  tx: DbTransaction,
  organizationId: string,
  userId: string,
): Promise<string[]> {
  const existing = await linkedStaffDepartmentKeys(tx, organizationId, userId);
  if (existing.length > 0) return existing;

  const isAdmin = await userIsOrgAdmin(tx, userId, organizationId);
  if (!isAdmin) return [];

  const [profile] = await tx
    .select({ fullName: users.fullName, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const staffId = crypto.randomUUID();
  const now = new Date();
  await tx.insert(staffMembers).values({
    id: staffId,
    organizationId,
    userId,
    fullName: profile?.fullName?.trim() || "Admin",
    email: profile?.email?.trim() || "",
    jobTitle: "Admin",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  await tx.insert(staffDepartmentAssignments).values([
    { staffId, departmentKey: "admin" },
    { staffId, departmentKey: "management" },
  ]);
  return ["admin", "management"];
}

export async function getInquiryWorkflowMapForUser(
  userId: string,
  orgCode: string,
): Promise<InquiryWorkflowMap | null> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrgId(tx, userId, orgCode);
    if (!org) return null;
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
    const org = await resolveOrgId(tx, userId, orgCode);
    if (!org) throw new Error("Company not found.");

    await ensureWorkflowRows(tx, org.id);
    const now = new Date();

    for (const stage of INQUIRY_STAGES) {
      const config = map[stage.key];
      await tx
        .update(inquiryWorkflowSettings)
        .set({
          departmentKey: config.departmentKey,
          approvalRequired: config.approvalRequired,
          approvalRequiredBy: config.approvalRequiredBy,
          updatedAt: now,
        })
        .where(
          and(
            eq(inquiryWorkflowSettings.organizationId, org.id),
            eq(inquiryWorkflowSettings.stageKey, stage.key),
          ),
        );
    }

    const openInquiries = await tx
      .select({
        id: inquiries.id,
        currentStage: inquiries.currentStage,
        owningDepartmentKey: inquiries.owningDepartmentKey,
      })
      .from(inquiries)
      .where(eq(inquiries.organizationId, org.id));

    for (const row of openInquiries) {
      const stage = isInquiryStageKey(row.currentStage)
        ? row.currentStage
        : "inquiry";
      const nextDept = departmentForStage(map, stage);
      if (row.owningDepartmentKey === nextDept) continue;
      await tx
        .update(inquiries)
        .set({
          owningDepartmentKey: nextDept,
          assignedStaffId: null,
          updatedAt: now,
        })
        .where(eq(inquiries.id, row.id));
    }

    return map;
  });
}

async function loadLineItems(tx: DbTransaction, inquiryIds: string[]) {
  if (inquiryIds.length === 0) {
    return new Map<string, InquiryView["lineItems"]>();
  }

  const rows = await tx
    .select()
    .from(inquiryLineItems)
    .where(inArray(inquiryLineItems.inquiryId, inquiryIds))
    .orderBy(asc(inquiryLineItems.sortOrder));

  const map = new Map<string, InquiryView["lineItems"]>();
  for (const row of rows) {
    const list = map.get(row.inquiryId) ?? [];
    list.push({
      id: row.id,
      description: row.description,
      quantity: String(row.quantity),
      unitPrice: String(row.unitPrice),
      sortOrder: row.sortOrder,
    });
    map.set(row.inquiryId, list);
  }
  return map;
}

function toInquiryView(
  row: typeof inquiries.$inferSelect,
  lineItems: InquiryView["lineItems"],
  assignedStaffName: string | null,
  extras?: {
    createdByName?: string;
    comments?: InquiryCommentView[];
    activityLogs?: InquiryActivityLogView[];
    approvalRequired?: boolean;
    approvalRequiredBy?: InquiryApprovalRoleKey | "";
    currentStageApproved?: boolean;
    canApproveCurrentStage?: boolean;
  },
): InquiryView {
  const stage = isInquiryStageKey(row.currentStage)
    ? row.currentStage
    : "inquiry";
  const dept = isInquiryWorkflowDepartmentKey(row.owningDepartmentKey)
    ? row.owningDepartmentKey
    : "admin";

  return {
    id: row.id,
    organizationId: row.organizationId,
    customerName: row.customerName,
    contact: row.contact,
    deliveryExpectedOn: row.deliveryExpectedOn,
    notes: row.notes,
    currentStage: stage,
    owningDepartmentKey: dept,
    assignedStaffId: row.assignedStaffId,
    assignedStaffName,
    source: row.source === "reception_visitor" ? "reception_visitor" : "admin",
    sourceVisitorId: row.sourceVisitorId,
    createdByUserId: row.createdByUserId,
    createdByName: extras?.createdByName ?? "",
    approvalRequired: extras?.approvalRequired ?? false,
    approvalRequiredBy: extras?.approvalRequiredBy ?? "",
    currentStageApproved: extras?.currentStageApproved ?? false,
    canApproveCurrentStage: extras?.canApproveCurrentStage ?? false,
    lineItems,
    comments: extras?.comments ?? [],
    activityLogs: extras?.activityLogs ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadInquiryExtras(
  tx: DbTransaction,
  inquiry: typeof inquiries.$inferSelect,
  userId: string,
  map: InquiryWorkflowMap,
): Promise<{
  createdByName: string;
  comments: InquiryCommentView[];
  activityLogs: InquiryActivityLogView[];
  approvalRequired: boolean;
  approvalRequiredBy: InquiryApprovalRoleKey | "";
  currentStageApproved: boolean;
  canApproveCurrentStage: boolean;
}> {
  const stage = isInquiryStageKey(inquiry.currentStage)
    ? inquiry.currentStage
    : "inquiry";
  const stageConfig = map[stage];
  const approvalRequired = Boolean(stageConfig?.approvalRequired);
  const approvalRequiredBy =
    approvalRequired && isInquiryApprovalRoleKey(stageConfig.approvalRequiredBy)
      ? stageConfig.approvalRequiredBy
      : ("" as const);

  const createdByName = await displayNameForUser(tx, inquiry.createdByUserId);

  const commentRows = await tx
    .select()
    .from(inquiryComments)
    .where(eq(inquiryComments.inquiryId, inquiry.id))
    .orderBy(asc(inquiryComments.createdAt));

  const comments: InquiryCommentView[] = [];
  for (const row of commentRows) {
    comments.push({
      id: row.id,
      body: row.body,
      authorUserId: row.authorUserId,
      authorName: await displayNameForUser(tx, row.authorUserId),
      createdAt: row.createdAt.toISOString(),
    });
  }

  const eventRows = await tx
    .select()
    .from(inquiryStageEvents)
    .where(eq(inquiryStageEvents.inquiryId, inquiry.id))
    .orderBy(asc(inquiryStageEvents.occurredAt));

  const activityLogs: InquiryActivityLogView[] = [];

  activityLogs.push({
    id: `created-${inquiry.id}`,
    label:
      inquiry.source === "reception_visitor"
        ? "Created from Reception visitor"
        : "Created in Admin",
    detail: inquiry.notes
      ? `Initial notes: ${inquiry.notes}`
      : "Inquiry opened at Inquiry stage",
    actorName: createdByName,
    occurredAt: inquiry.createdAt.toISOString(),
  });

  for (const event of eventRows) {
    if (!event.fromStage && event.toStage === "inquiry") {
      continue;
    }
    const actorName = event.actorUserId
      ? await displayNameForUser(tx, event.actorUserId)
      : null;
    const approvedInPlace =
      Boolean(event.fromStage) &&
      event.fromStage === event.toStage &&
      event.note.toLowerCase().startsWith("approved");
    activityLogs.push({
      id: event.id,
      label: approvedInPlace
        ? `Approved ${inquiryStageLabel(event.toStage)}`
        : event.fromStage
          ? `Moved ${inquiryStageLabel(event.fromStage)} → ${inquiryStageLabel(event.toStage)}`
          : `Stage set to ${inquiryStageLabel(event.toStage)}`,
      detail: event.note || "",
      actorName,
      occurredAt: event.occurredAt.toISOString(),
    });
  }

  const [approval] = approvalRequired
    ? await tx
        .select({ id: inquiryStageApprovals.id })
        .from(inquiryStageApprovals)
        .where(
          and(
            eq(inquiryStageApprovals.inquiryId, inquiry.id),
            eq(inquiryStageApprovals.stageKey, stage),
          ),
        )
        .limit(1)
    : [null];

  const currentStageApproved = Boolean(approval);
  let canApproveCurrentStage = false;
  if (approvalRequired && !currentStageApproved) {
    const depts = await ensureLinkedApproverStaff(
      tx,
      inquiry.organizationId,
      userId,
    );
    canApproveCurrentStage =
      Boolean(approvalRequiredBy) && depts.includes(approvalRequiredBy);
  }

  return {
    createdByName,
    comments,
    activityLogs,
    approvalRequired,
    approvalRequiredBy,
    currentStageApproved,
    canApproveCurrentStage,
  };
}

export async function listInquiriesForUser(
  userId: string,
  orgCode: string,
): Promise<InquiryView[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrgId(tx, userId, orgCode);
    if (!org) return [];

    const rows = await tx
      .select({
        inquiry: inquiries,
        assignedName: staffMembers.fullName,
      })
      .from(inquiries)
      .leftJoin(staffMembers, eq(staffMembers.id, inquiries.assignedStaffId))
      .where(eq(inquiries.organizationId, org.id))
      .orderBy(desc(inquiries.updatedAt));

    const lineMap = await loadLineItems(
      tx,
      rows.map((row) => row.inquiry.id),
    );

    return rows.map((row) =>
      toInquiryView(
        row.inquiry,
        lineMap.get(row.inquiry.id) ?? [],
        row.assignedName ?? null,
      ),
    );
  });
}

export async function listInquiriesForDepartment(
  userId: string,
  orgCode: string,
  departmentKey: InquiryWorkflowDepartmentKey,
): Promise<InquiryView[]> {
  const all = await listInquiriesForUser(userId, orgCode);
  return all.filter((item) => item.owningDepartmentKey === departmentKey);
}

export async function listInvoiceQueueForUser(
  userId: string,
  orgCode: string,
  departmentKey: InquiryWorkflowDepartmentKey,
): Promise<InquiryView[]> {
  const all = await listInquiriesForDepartment(
    userId,
    orgCode,
    departmentKey,
  );

  return all.filter((item) =>
    (INVOICE_STAGE_KEYS as readonly string[]).includes(item.currentStage),
  );
}

export async function getInquiryForUser(
  userId: string,
  orgCode: string,
  inquiryId: string,
): Promise<InquiryView | null> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrgId(tx, userId, orgCode);
    if (!org) return null;

    const [row] = await tx
      .select({
        inquiry: inquiries,
        assignedName: staffMembers.fullName,
      })
      .from(inquiries)
      .leftJoin(staffMembers, eq(staffMembers.id, inquiries.assignedStaffId))
      .where(
        and(eq(inquiries.id, inquiryId), eq(inquiries.organizationId, org.id)),
      )
      .limit(1);

    if (!row) return null;
    const map = await loadWorkflowMap(tx, org.id);
    const lineMap = await loadLineItems(tx, [row.inquiry.id]);
    const extras = await loadInquiryExtras(tx, row.inquiry, userId, map);
    return toInquiryView(
      row.inquiry,
      lineMap.get(row.inquiry.id) ?? [],
      row.assignedName ?? null,
      extras,
    );
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
    throw new Error("Enter a comment.");
  }

  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrgId(tx, userId, orgCode);
    if (!org) throw new Error("Company not found.");

    const [existing] = await tx
      .select()
      .from(inquiries)
      .where(
        and(eq(inquiries.id, inquiryId), eq(inquiries.organizationId, org.id)),
      )
      .limit(1);

    if (!existing) throw new Error("Inquiry not found.");
    if (!existing.assignedStaffId) {
      throw new Error("Assign someone before posting comments.");
    }

    const now = new Date();
    await tx.insert(inquiryComments).values({
      id: crypto.randomUUID(),
      organizationId: org.id,
      inquiryId,
      authorUserId: userId,
      body: text,
      createdAt: now,
      updatedAt: now,
    });

    const [row] = await tx
      .select({
        inquiry: inquiries,
        assignedName: staffMembers.fullName,
      })
      .from(inquiries)
      .leftJoin(staffMembers, eq(staffMembers.id, inquiries.assignedStaffId))
      .where(eq(inquiries.id, inquiryId))
      .limit(1);
    if (!row) throw new Error("Could not post comment.");

    const map = await loadWorkflowMap(tx, org.id);
    const lineMap = await loadLineItems(tx, [inquiryId]);
    const extras = await loadInquiryExtras(tx, row.inquiry, userId, map);
    return toInquiryView(
      row.inquiry,
      lineMap.get(inquiryId) ?? [],
      row.assignedName ?? null,
      extras,
    );
  });
}

async function replaceLineItems(
  tx: DbTransaction,
  inquiryId: string,
  items: InquiryCreateInput["lineItems"],
) {
  await tx.delete(inquiryLineItems).where(eq(inquiryLineItems.inquiryId, inquiryId));
  if (items.length === 0) return;

  const now = new Date();
  await tx.insert(inquiryLineItems).values(
    items.map((item, index) => ({
      id: crypto.randomUUID(),
      inquiryId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      sortOrder: index,
      createdAt: now,
      updatedAt: now,
    })),
  );
}

export async function createInquiryForUser(
  userId: string,
  orgCode: string,
  input: InquiryCreateInput,
  options?: {
    source?: "admin" | "reception_visitor";
    sourceVisitorId?: string | null;
  },
): Promise<InquiryView> {
  const normalized = normalizeInquiryCreateInput(input);

  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrgId(tx, userId, orgCode);
    if (!org) throw new Error("Company not found.");

    const map = await loadWorkflowMap(tx, org.id);

    const id = crypto.randomUUID();
    const now = new Date();
    const owningDepartmentKey = departmentForStage(map, "inquiry");

    await tx.insert(inquiries).values({
      id,
      organizationId: org.id,
      customerName: normalized.customerName,
      contact: normalized.contact,
      deliveryExpectedOn: normalized.deliveryExpectedOn,
      notes: normalized.notes,
      currentStage: "inquiry",
      owningDepartmentKey,
      assignedStaffId: null,
      source: options?.source ?? "admin",
      sourceVisitorId: options?.sourceVisitorId ?? null,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });

    await replaceLineItems(tx, id, normalized.lineItems);

    await tx.insert(inquiryStageEvents).values({
      id: crypto.randomUUID(),
      organizationId: org.id,
      inquiryId: id,
      fromStage: "",
      toStage: "inquiry",
      actorUserId: userId,
      occurredAt: now,
      note: options?.source === "reception_visitor" ? "From Reception visitor" : "Created",
      createdAt: now,
      updatedAt: now,
    });

    const [row] = await tx
      .select()
      .from(inquiries)
      .where(eq(inquiries.id, id))
      .limit(1);
    if (!row) throw new Error("Could not create inquiry.");

    const lineMap = await loadLineItems(tx, [id]);
    const extras = await loadInquiryExtras(tx, row, userId, map);
    return toInquiryView(row, lineMap.get(id) ?? [], null, extras);
  });
}

export async function updateInquiryForUser(
  userId: string,
  orgCode: string,
  inquiryId: string,
  input: InquiryUpdateInput,
): Promise<InquiryView> {
  const normalized = normalizeInquiryCreateInput(input);

  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrgId(tx, userId, orgCode);
    if (!org) throw new Error("Company not found.");

    const [existing] = await tx
      .select()
      .from(inquiries)
      .where(
        and(eq(inquiries.id, inquiryId), eq(inquiries.organizationId, org.id)),
      )
      .limit(1);

    if (!existing) throw new Error("Inquiry not found.");
    if (!existing.assignedStaffId) {
      throw new Error("Assign someone before editing this inquiry.");
    }

    const now = new Date();
    await tx
      .update(inquiries)
      .set({
        customerName: normalized.customerName,
        contact: normalized.contact,
        deliveryExpectedOn: normalized.deliveryExpectedOn,
        notes: existing.notes,
        updatedAt: now,
      })
      .where(eq(inquiries.id, inquiryId));

    await replaceLineItems(tx, inquiryId, normalized.lineItems);

    const [row] = await tx
      .select({
        inquiry: inquiries,
        assignedName: staffMembers.fullName,
      })
      .from(inquiries)
      .leftJoin(staffMembers, eq(staffMembers.id, inquiries.assignedStaffId))
      .where(eq(inquiries.id, inquiryId))
      .limit(1);
    if (!row) throw new Error("Could not update inquiry.");
    const map = await loadWorkflowMap(tx, org.id);
    const lineMap = await loadLineItems(tx, [inquiryId]);
    const extras = await loadInquiryExtras(tx, row.inquiry, userId, map);
    return toInquiryView(
      row.inquiry,
      lineMap.get(inquiryId) ?? [],
      row.assignedName ?? null,
      extras,
    );
  });
}

export async function listAssignableStaffForDepartment(
  userId: string,
  orgCode: string,
  departmentKey: InquiryWorkflowDepartmentKey,
): Promise<{ id: string; fullName: string; jobTitle: string }[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrgId(tx, userId, orgCode);
    if (!org) return [];

    const rows = await tx
      .select({
        id: staffMembers.id,
        fullName: staffMembers.fullName,
        jobTitle: staffMembers.jobTitle,
        departmentKey: staffDepartmentAssignments.departmentKey,
      })
      .from(staffMembers)
      .innerJoin(
        staffDepartmentAssignments,
        eq(staffDepartmentAssignments.staffId, staffMembers.id),
      )
      .where(
        and(
          eq(staffMembers.organizationId, org.id),
          eq(staffMembers.status, "active"),
        ),
      )
      .orderBy(asc(staffMembers.fullName));

    const byId = new Map<string, { id: string; fullName: string; jobTitle: string }>();
    for (const row of rows) {
      if (row.departmentKey !== departmentKey) continue;
      byId.set(row.id, {
        id: row.id,
        fullName: row.fullName,
        jobTitle: row.jobTitle,
      });
    }
    return Array.from(byId.values());
  });
}

export async function assignInquiryForUser(
  userId: string,
  orgCode: string,
  inquiryId: string,
  staffId: string,
): Promise<InquiryView> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrgId(tx, userId, orgCode);
    if (!org) throw new Error("Company not found.");

    const [existing] = await tx
      .select()
      .from(inquiries)
      .where(
        and(eq(inquiries.id, inquiryId), eq(inquiries.organizationId, org.id)),
      )
      .limit(1);

    if (!existing) throw new Error("Inquiry not found.");

    const dept = isInquiryWorkflowDepartmentKey(existing.owningDepartmentKey)
      ? existing.owningDepartmentKey
      : "admin";

    const [assignment] = await tx
      .select()
      .from(staffDepartmentAssignments)
      .innerJoin(
        staffMembers,
        and(
          eq(staffMembers.id, staffDepartmentAssignments.staffId),
          eq(staffMembers.organizationId, org.id),
        ),
      )
      .where(
        and(
          eq(staffDepartmentAssignments.staffId, staffId),
          eq(staffDepartmentAssignments.departmentKey, dept),
        ),
      )
      .limit(1);

    if (!assignment) {
      throw new Error("Select a staff member from this department.");
    }

    await tx
      .update(inquiries)
      .set({ assignedStaffId: staffId, updatedAt: new Date() })
      .where(eq(inquiries.id, inquiryId));

    const [row] = await tx
      .select({
        inquiry: inquiries,
        assignedName: staffMembers.fullName,
      })
      .from(inquiries)
      .leftJoin(staffMembers, eq(staffMembers.id, inquiries.assignedStaffId))
      .where(eq(inquiries.id, inquiryId))
      .limit(1);
    if (!row) throw new Error("Could not assign inquiry.");
    const map = await loadWorkflowMap(tx, org.id);
    const lineMap = await loadLineItems(tx, [inquiryId]);
    const extras = await loadInquiryExtras(tx, row.inquiry, userId, map);
    return toInquiryView(
      row.inquiry,
      lineMap.get(inquiryId) ?? [],
      row.assignedName ?? null,
      extras,
    );
  });
}

export async function approveInquiryStageForUser(
  userId: string,
  orgCode: string,
  inquiryId: string,
): Promise<InquiryView> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrgId(tx, userId, orgCode);
    if (!org) throw new Error("Company not found.");

    const [existing] = await tx
      .select()
      .from(inquiries)
      .where(
        and(eq(inquiries.id, inquiryId), eq(inquiries.organizationId, org.id)),
      )
      .limit(1);
    if (!existing) throw new Error("Inquiry not found.");
    if (!existing.assignedStaffId) {
      throw new Error("Assign a person before approving this stage.");
    }

    const map = await loadWorkflowMap(tx, org.id);
    const current = isInquiryStageKey(existing.currentStage)
      ? existing.currentStage
      : "inquiry";
    const config = map[current];
    if (!config.approvalRequired || !isInquiryApprovalRoleKey(config.approvalRequiredBy)) {
      throw new Error("This stage does not require approval.");
    }

    const depts = await ensureLinkedApproverStaff(tx, org.id, userId);
    if (!depts.includes(config.approvalRequiredBy)) {
      throw new Error(
        `Only ${config.approvalRequiredBy === "management" ? "Management" : "Engineering Department"} can approve this stage.`,
      );
    }

    const [already] = await tx
      .select({ id: inquiryStageApprovals.id })
      .from(inquiryStageApprovals)
      .where(
        and(
          eq(inquiryStageApprovals.inquiryId, inquiryId),
          eq(inquiryStageApprovals.stageKey, current),
        ),
      )
      .limit(1);
    if (already) {
      throw new Error("This stage is already approved.");
    }

    const now = new Date();
    await tx.insert(inquiryStageApprovals).values({
      id: crypto.randomUUID(),
      organizationId: org.id,
      inquiryId,
      stageKey: current,
      requiredBy: config.approvalRequiredBy,
      approvedByUserId: userId,
      approvedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(inquiryStageEvents).values({
      id: crypto.randomUUID(),
      organizationId: org.id,
      inquiryId,
      fromStage: current,
      toStage: current,
      actorUserId: userId,
      occurredAt: now,
      note: `Approved by ${config.approvalRequiredBy}`,
      createdAt: now,
      updatedAt: now,
    });

    const [row] = await tx
      .select({
        inquiry: inquiries,
        assignedName: staffMembers.fullName,
      })
      .from(inquiries)
      .leftJoin(staffMembers, eq(staffMembers.id, inquiries.assignedStaffId))
      .where(eq(inquiries.id, inquiryId))
      .limit(1);
    if (!row) throw new Error("Could not approve stage.");
    const lineMap = await loadLineItems(tx, [inquiryId]);
    const extras = await loadInquiryExtras(tx, row.inquiry, userId, map);
    return toInquiryView(
      row.inquiry,
      lineMap.get(inquiryId) ?? [],
      row.assignedName ?? null,
      extras,
    );
  });
}

export async function moveInquiryStageForUser(
  userId: string,
  orgCode: string,
  inquiryId: string,
  direction: "previous" | "next",
): Promise<InquiryView> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrgId(tx, userId, orgCode);
    if (!org) throw new Error("Company not found.");

    const [existing] = await tx
      .select()
      .from(inquiries)
      .where(
        and(eq(inquiries.id, inquiryId), eq(inquiries.organizationId, org.id)),
      )
      .limit(1);

    if (!existing) throw new Error("Inquiry not found.");
    if (!existing.assignedStaffId) {
      throw new Error("Assign a person before moving stages.");
    }

    const current = isInquiryStageKey(existing.currentStage)
      ? existing.currentStage
      : "inquiry";
    const index = INQUIRY_STAGES.findIndex((stage) => stage.key === current);
    const targetIndex = direction === "next" ? index + 1 : index - 1;
    if (targetIndex < 0 || targetIndex >= INQUIRY_STAGES.length) {
      throw new Error("No further stage in that direction.");
    }
    const toStage = INQUIRY_STAGES[targetIndex]!.key;
    assertAdjacentStageMove(current, toStage);

    const map = await loadWorkflowMap(tx, org.id);
    const currentConfig = map[current];

    if (direction === "next" && currentConfig.approvalRequired) {
      const [approval] = await tx
        .select({ id: inquiryStageApprovals.id })
        .from(inquiryStageApprovals)
        .where(
          and(
            eq(inquiryStageApprovals.inquiryId, inquiryId),
            eq(inquiryStageApprovals.stageKey, current),
          ),
        )
        .limit(1);
      if (!approval) {
        const who =
          currentConfig.approvalRequiredBy === "engineering"
            ? "Engineering Department"
            : "Management";
        throw new Error(`Approval required by ${who} before moving to the next stage.`);
      }
    }

    const previousDept = departmentForStage(map, current);
    const nextDept = departmentForStage(map, toStage);
    const now = new Date();

    await tx
      .update(inquiries)
      .set({
        currentStage: toStage,
        owningDepartmentKey: nextDept,
        assignedStaffId: previousDept === nextDept ? existing.assignedStaffId : null,
        updatedAt: now,
      })
      .where(eq(inquiries.id, inquiryId));

    await tx.insert(inquiryStageEvents).values({
      id: crypto.randomUUID(),
      organizationId: org.id,
      inquiryId,
      fromStage: current,
      toStage,
      actorUserId: userId,
      occurredAt: now,
      note: "",
      createdAt: now,
      updatedAt: now,
    });

    const [row] = await tx
      .select({
        inquiry: inquiries,
        assignedName: staffMembers.fullName,
      })
      .from(inquiries)
      .leftJoin(staffMembers, eq(staffMembers.id, inquiries.assignedStaffId))
      .where(eq(inquiries.id, inquiryId))
      .limit(1);
    if (!row) throw new Error("Could not move inquiry stage.");
    const lineMap = await loadLineItems(tx, [inquiryId]);
    const extras = await loadInquiryExtras(tx, row.inquiry, userId, map);
    return toInquiryView(
      row.inquiry,
      lineMap.get(inquiryId) ?? [],
      row.assignedName ?? null,
      extras,
    );
  });
}

/** Create visitor-linked starter inquiry inside an existing tenant transaction. */
export async function createStarterInquiryInTx(
  tx: DbTransaction,
  args: {
    userId: string;
    organizationId: string;
    customerName: string;
    notes: string;
    sourceVisitorId: string;
  },
): Promise<string> {
  const map = await loadWorkflowMap(tx, args.organizationId);

  const id = crypto.randomUUID();
  const now = new Date();
  const owningDepartmentKey = departmentForStage(map, "inquiry");

  await tx.insert(inquiries).values({
    id,
    organizationId: args.organizationId,
    customerName: args.customerName,
    contact: "",
    deliveryExpectedOn: "",
    notes: args.notes,
    currentStage: "inquiry",
    owningDepartmentKey,
    assignedStaffId: null,
    source: "reception_visitor",
    sourceVisitorId: args.sourceVisitorId,
    createdByUserId: args.userId,
    createdAt: now,
    updatedAt: now,
  });

  await tx.insert(inquiryStageEvents).values({
    id: crypto.randomUUID(),
    organizationId: args.organizationId,
    inquiryId: id,
    fromStage: "",
    toStage: "inquiry",
    actorUserId: args.userId,
    occurredAt: now,
    note: "From Reception visitor",
    createdAt: now,
    updatedAt: now,
  });

  await tx
    .update(visitorLogs)
    .set({ inquiryId: id, updatedAt: now })
    .where(eq(visitorLogs.id, args.sourceVisitorId));

  return id;
}
