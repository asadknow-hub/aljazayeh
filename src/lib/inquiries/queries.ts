import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { withTenantContext, type DbTransaction } from "@/db/client";
import {
  inquiries,
  inquiryComments,
  inquiryLineItems,
  inquiryStageApprovals,
  inquiryStageEvents,
  inquiryStageRecords,
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
  INQUIRY_STAGES,
  INQUIRY_WORKFLOW_DEPARTMENTS,
  stagesForJob,
  inquiryStageLabel,
  isInquiryStageKey,
  isInquiryWorkflowDepartmentKey,
  workflowDepartmentLabel,
  type InquiryStageKey,
  type InquiryWorkflowDepartmentKey,
  type InquiryWorkflowMap,
} from "@/lib/inquiries/stages";
import {
  BANK_FIELD,
  LETTERHEAD_FIELD,
  documentsInUse,
  INQUIRY_COUNTER_KEY,
  inquiryTotals,
  mainDocument,
  missingStageFields,
  numberCode,
  STAGE_DEFINITIONS,
  stageCounterKey,
  STEP_FORM,
  type StepTemplate,
} from "@/lib/inquiries/stage-forms";
import type {
  AssignableStaff,
  InquiryActivityLogView,
  InquiryCommentView,
  InquiryLineItemInput,
  InquiryLineItemView,
  InquiryStageInput,
  InquiryStatus,
  InquiryStepView,
  InquirySummary,
  InquiryView,
} from "@/lib/inquiries/types";
import {
  normalizeInquiryWorkflowMap,
  normalizeLineItems,
  normalizeStageFields,
  normalizeStageTables,
} from "@/lib/inquiries/validate";
import { appDateValue } from "@/lib/datetime/format";
import { loadBankAccounts } from "@/lib/banks/queries";
import type { BankDetails } from "@/lib/banks/types";
import { loadStepTemplates } from "@/lib/company-docs/templates";
import { loadLetterheads } from "@/lib/company-settings/queries";
import {
  approverOptions,
  stepApprover,
  type StepApprover,
} from "@/lib/inquiries/approvers";
import { loadPositions } from "@/lib/organization/positions";
import { nextDocumentNumber } from "@/lib/documents/numbering";
import {
  insertAttachment,
  keepOnlyAttachments,
  listAttachments,
  loadAttachmentFile,
  readUploadedFile,
  type AttachmentView,
} from "@/lib/inquiries/attachments";
import { requireOrg, resolveOrg, type ResolvedOrg } from "@/lib/org/resolve";
import { isUuid } from "@/lib/ids";

type InquiryRow = typeof inquiries.$inferSelect;
type StageRecordRow = typeof inquiryStageRecords.$inferSelect;

function stageOf(row: InquiryRow): InquiryStageKey {
  return isInquiryStageKey(row.currentStage) ? row.currentStage : "inquiry";
}

function ownerOf(row: InquiryRow): InquiryWorkflowDepartmentKey {
  return isInquiryWorkflowDepartmentKey(row.owningDepartmentKey)
    ? row.owningDepartmentKey
    : "admin";
}

function statusOf(row: InquiryRow): InquiryStatus {
  return row.status === "completed" || row.status === "cancelled"
    ? row.status
    : "open";
}

/* ------------------------------ workflow map ------------------------------ */

/**
 * How the company runs the inquiry process: who prepares each step, and who
 * approves it. The approvers come from the organisation chart.
 */
export type Workflow = {
  map: InquiryWorkflowMap;
  /** Per step: who approves it, or nothing if it needs no approval. */
  approvers: Record<InquiryStageKey, StepApprover | null>;
};

export async function loadWorkflow(
  tx: DbTransaction,
  organizationId: string,
): Promise<Workflow> {
  const rows = await tx
    .select()
    .from(inquiryWorkflowSettings)
    .where(eq(inquiryWorkflowSettings.organizationId, organizationId));
  const positions = await loadPositions(tx, organizationId);

  // Stages without a saved row fall back to the defaults.
  const map = defaultInquiryWorkflowMap();
  const approvers = {} as Workflow["approvers"];
  for (const stage of INQUIRY_STAGES) {
    const row = rows.find((item) => item.stageKey === stage.key);
    const saved =
      row && isInquiryWorkflowDepartmentKey(row.departmentKey)
        ? {
            departmentKey: row.departmentKey,
            approvalRequired: row.approvalRequired,
            approvalRequiredBy: row.approvalRequiredBy,
          }
        : map[stage.key];
    const approver = stepApprover(saved, positions);
    approvers[stage.key] = approver;
    // A step whose approver is no longer on the chart needs no approval.
    map[stage.key] = {
      departmentKey: saved.departmentKey,
      approvalRequired: approver !== null,
      approvalRequiredBy: approver?.key ?? "",
    };
  }
  return { map, approvers };
}

export async function loadWorkflowMap(
  tx: DbTransaction,
  organizationId: string,
): Promise<InquiryWorkflowMap> {
  return (await loadWorkflow(tx, organizationId)).map;
}

/** Whether the signed-in person may approve a step. */
function isApprover(org: ResolvedOrg, approver: StepApprover | null): boolean {
  return approver !== null && approver.staffIds.includes(org.access.staffId);
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
  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    assertCan(can.manageCompany(org.access));
    const map = normalizeInquiryWorkflowMap(input, {
      departments: new Set(
        INQUIRY_WORKFLOW_DEPARTMENTS.map((item) => item.key).filter(
          (key) => !org.access.closedDepartments.includes(key),
        ),
      ),
      approvers: new Set(
        approverOptions(await loadPositions(tx, org.id)).map(
          (option) => option.key,
        ),
      ),
    });
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

function toLineItemView(
  row: typeof inquiryLineItems.$inferSelect,
): InquiryLineItemView {
  return {
    id: row.id,
    description: row.description,
    // Quantities are shown without trailing zeros: 12, not 12.00.
    quantity: String(Number(row.quantity)),
    unit: row.unit,
    unitPrice: String(row.unitPrice),
    deliveredQuantity:
      row.deliveredQuantity === null
        ? ""
        : String(Number(row.deliveredQuantity)),
    details: row.details,
  };
}

async function loadLineItems(tx: DbTransaction, inquiryIds: string[]) {
  const byInquiry = new Map<string, InquiryLineItemView[]>();
  if (inquiryIds.length === 0) return byInquiry;

  const rows = await tx
    .select()
    .from(inquiryLineItems)
    .where(inArray(inquiryLineItems.inquiryId, inquiryIds))
    .orderBy(asc(inquiryLineItems.sortOrder));

  for (const row of rows) {
    const list = byInquiry.get(row.inquiryId) ?? [];
    list.push(toLineItemView(row));
    byInquiry.set(row.inquiryId, list);
  }
  return byInquiry;
}

/** The saved record of each step, per inquiry. */
async function loadStageRecords(
  tx: DbTransaction,
  inquiryIds: string[],
  stage?: InquiryStageKey,
) {
  const byInquiry = new Map<string, Map<string, StageRecordRow>>();
  if (inquiryIds.length === 0) return byInquiry;

  const rows = await tx
    .select()
    .from(inquiryStageRecords)
    .where(
      and(
        inArray(inquiryStageRecords.inquiryId, inquiryIds),
        stage ? eq(inquiryStageRecords.stageKey, stage) : undefined,
      ),
    );

  for (const row of rows) {
    const records = byInquiry.get(row.inquiryId) ?? new Map();
    records.set(row.stageKey, row);
    byInquiry.set(row.inquiryId, records);
  }
  return byInquiry;
}

/** Display names for a set of users, one query per distinct user. */
export async function loadDisplayNames(
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

/** Inquiry-step answers that are columns of the inquiry itself. */
const INQUIRY_HEADER_FIELDS = new Set([
  "customerName",
  "contact",
  "title",
  "jobType",
  "deliveryExpectedOn",
  "details",
]);

/**
 * The answers of the Inquiry step. The ones every list and document needs
 * (customer, title, …) are columns of the inquiry; the rest are in its
 * step record.
 */
function inquiryStepFields(
  row: InquiryRow,
  record: StageRecordRow | undefined,
): Record<string, string> {
  return {
    ...(record?.fields ?? {}),
    customerName: row.customerName,
    contact: row.contact,
    title: row.title,
    jobType: row.jobType,
    deliveryExpectedOn: row.deliveryExpectedOn,
    details: row.notes,
  };
}

function toSummary(
  row: InquiryRow,
  access: OrgAccess,
  items: InquiryLineItemView[],
  quotation: StageRecordRow | undefined,
  assignedStaffName: string | null,
): InquirySummary {
  const owner = ownerOf(row);
  const open = statusOf(row) === "open";
  return {
    id: row.id,
    number: row.inquiryNumber,
    title: row.title,
    customerName: row.customerName,
    contact: row.contact,
    deliveryExpectedOn: row.deliveryExpectedOn,
    jobType: row.jobType,
    status: statusOf(row),
    currentStage: stageOf(row),
    daysInStage: Math.max(
      0,
      Math.floor((Date.now() - row.stageEnteredAt.getTime()) / 86_400_000),
    ),
    overdue:
      open &&
      row.deliveryExpectedOn !== "" &&
      row.deliveryExpectedOn < appDateValue(),
    owningDepartmentKey: owner,
    assignedStaffId: row.assignedStaffId,
    assignedStaffName,
    totals: inquiryTotals(items, quotation?.fields),
    canWork: open && can.workInquiry(access, owner),
    canAssign: open && can.assignInquiry(access, owner),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadInquiryList(
  tx: DbTransaction,
  org: ResolvedOrg,
  filter: {
    department?: InquiryWorkflowDepartmentKey;
    assignedStaffId?: string;
    openOnly?: boolean;
  } = {},
): Promise<InquirySummary[]> {
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
        filter.assignedStaffId
          ? eq(inquiries.assignedStaffId, filter.assignedStaffId)
          : undefined,
        filter.openOnly ? eq(inquiries.status, "open") : undefined,
      ),
    )
    .orderBy(desc(inquiries.updatedAt));

  const ids = rows.map((row) => row.inquiry.id);
  const lineItems = await loadLineItems(tx, ids);
  const quotations = await loadStageRecords(tx, ids, "quotation");

  return rows.map((row) =>
    toSummary(
      row.inquiry,
      org.access,
      lineItems.get(row.inquiry.id) ?? [],
      quotations.get(row.inquiry.id)?.get("quotation"),
      row.assignedName,
    ),
  );
}

/** Every inquiry in the company: the Admin workspace. */
export async function listInquiriesForUser(
  userId: string,
  orgCode: string,
): Promise<InquirySummary[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.viewAllInquiries(org.access)) return [];
    return loadInquiryList(tx, org);
  });
}

/** Inquiries whose current step is handled by one department. */
export async function listInquiriesForDepartment(
  userId: string,
  orgCode: string,
  departmentKey: InquiryWorkflowDepartmentKey,
): Promise<InquirySummary[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.openDepartment(org.access, departmentKey)) return [];
    return loadInquiryList(tx, org, { department: departmentKey });
  });
}

type InquiryTask = {
  inquiry: InquirySummary;
  /** Why it is on this person's list. */
  reason: "assigned" | "approval";
};

/**
 * Open inquiries waiting on the signed-in person: the ones assigned to them,
 * and the ones whose current step needs an approval they can give.
 */
export async function listInquiryTasksForUser(
  userId: string,
  orgCode: string,
): Promise<InquiryTask[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org) return [];

    const mine = await loadInquiryList(tx, org, {
      assignedStaffId: org.access.staffId,
      openOnly: true,
    });
    const tasks: InquiryTask[] = mine.map((inquiry) => ({
      inquiry,
      reason: "assigned",
    }));

    const { approvers } = await loadWorkflow(tx, org.id);
    const approvable = INQUIRY_STAGES.filter((stage) =>
      isApprover(org, approvers[stage.key]),
    ).map((stage) => stage.key as string);
    if (approvable.length === 0) return tasks;

    const waiting = (await loadInquiryList(tx, org, { openOnly: true })).filter(
      (inquiry) => approvable.includes(inquiry.currentStage),
    );
    const records = await loadStageRecords(
      tx,
      waiting.map((inquiry) => inquiry.id),
    );
    for (const inquiry of waiting) {
      // Only what has actually been sent for approval is waiting on them.
      const record = records.get(inquiry.id)?.get(inquiry.currentStage);
      if (record?.approvalRequestedAt) {
        tasks.push({ inquiry, reason: "approval" });
      }
    }
    return tasks;
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

/** The department that must approve the inquiry's current step, if any. */
/** Whoever owns, oversees or must approve an inquiry may open it. */
function canView(org: ResolvedOrg, workflow: Workflow, row: InquiryRow): boolean {
  return (
    can.viewInquiry(org.access, ownerOf(row)) ||
    isApprover(org, workflow.approvers[stageOf(row)])
  );
}

async function requireInquiry(
  tx: DbTransaction,
  org: ResolvedOrg,
  inquiryId: string,
): Promise<InquiryRow> {
  const row = await findInquiry(tx, org, inquiryId);
  if (!row || !canView(org, await loadWorkflow(tx, org.id), row)) {
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

/** The full inquiry as shown on its page: every step, notes and history. */
async function loadInquiryView(
  tx: DbTransaction,
  org: ResolvedOrg,
  row: InquiryRow,
): Promise<InquiryView> {
  const stage = stageOf(row);
  const status = statusOf(row);
  const { map, approvers } = await loadWorkflow(tx, org.id);
  const config = map[stage];
  const records =
    (await loadStageRecords(tx, [row.id])).get(row.id) ??
    new Map<string, StageRecordRow>();

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
    ...[...records.values()].map((record) => record.completedByUserId),
  ]);
  const createdByName = names.get(row.createdByUserId) ?? "";

  const [assigned] = row.assignedStaffId
    ? await tx
        .select({ fullName: staffMembers.fullName })
        .from(staffMembers)
        .where(eq(staffMembers.id, row.assignedStaffId))
        .limit(1)
    : [];

  // Each step's own person: who handled it, or who it is planned for.
  const handlerIds = [...records.values()].flatMap((record) =>
    record.handledByStaffId ? [record.handledByStaffId] : [],
  );
  const handlerNames = new Map(
    handlerIds.length > 0
      ? (
          await tx
            .select({ id: staffMembers.id, fullName: staffMembers.fullName })
            .from(staffMembers)
            .where(inArray(staffMembers.id, handlerIds))
        ).map((staff) => [staff.id, staff.fullName])
      : [],
  );

  const live = await loadStepTemplates(tx, org.id);
  const stages = stagesForJob(row.jobType);
  const currentIndex = stages.findIndex((item) => item.key === stage);
  const steps: InquiryStepView[] = stages.map((item, index) => {
    const record = records.get(item.key);
    const state =
      status === "completed" || index < currentIndex
        ? "done"
        : index === currentIndex
          ? "current"
          : "locked";
    const reached = state !== "locked";
    const handlerStaffId =
      state === "current"
        ? row.assignedStaffId
        : (record?.handledByStaffId ?? null);
    const completedByName =
      state === "done" && record?.completedByUserId
        ? (names.get(record.completedByUserId) ?? null)
        : null;
    return {
      key: item.key,
      number: index + 1,
      label: item.label,
      departmentKey: departmentForStage(map, item.key),
      state,
      documentNumber:
        item.key === "inquiry"
          ? row.inquiryNumber
          : (record?.documentNumber ?? ""),
      documentNumbers: record?.documentNumbers ?? {},
      // A step that has not been reached shows nothing yet.
      fields: !reached
        ? {}
        : item.key === "inquiry"
          ? inquiryStepFields(row, record)
          : (record?.fields ?? {}),
      tables: reached ? (record?.tables ?? {}) : {},
      // A finished step keeps the papers as they were when it was finished.
      template:
        state === "done" ? (record?.template ?? {}) : (live[item.key] ?? {}),
      bank: reached ? (record?.bank ?? null) : null,
      handlerStaffId,
      handlerName:
        state === "current"
          ? (assigned?.fullName ?? null)
          : handlerStaffId
            ? (handlerNames.get(handlerStaffId) ?? null)
            : // Steps finished before handlers were kept per step.
              completedByName,
      canPlan:
        status === "open" &&
        state === "locked" &&
        can.assignInquiry(org.access, departmentForStage(map, item.key)),
      preparedByName:
        state === "done" && record?.completedByUserId
          ? (names.get(record.completedByUserId) ?? null)
          : state === "current"
            ? (assigned?.fullName ?? null)
            : null,
      completedAt:
        state === "done" ? (record?.completedAt?.toISOString() ?? null) : null,
      completedByName:
        state === "done" && record?.completedByUserId
          ? (names.get(record.completedByUserId) ?? null)
          : null,
      approvalRequired: map[item.key].approvalRequired,
      approvalBy: approvers[item.key]?.label ?? "",
    };
  });

  const comments: InquiryCommentView[] = commentRows.map((comment) => ({
    id: comment.id,
    body: comment.body,
    authorName: names.get(comment.authorUserId) ?? "",
    createdAt: comment.createdAt.toISOString(),
  }));

  const activityLogs: InquiryActivityLogView[] = [
    {
      id: `created-${row.id}`,
      label:
        row.source === "reception_visitor"
          ? "Started from a Reception visitor"
          : "Inquiry created",
      detail: "",
      actorName: createdByName,
      occurredAt: row.createdAt.toISOString(),
    },
    ...eventRows
      // The creation event is already represented by the entry above.
      .filter((event) => event.fromStage)
      .map((event) => ({
        id: event.id,
        // A step change, or something that happened within a step.
        label:
          event.fromStage === event.toStage
            ? event.note
            : `${inquiryStageLabel(event.fromStage)} → ${inquiryStageLabel(event.toStage)}`,
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

  const approvalRequired = status === "open" && config.approvalRequired;
  const currentStageApproved =
    approvalRequired && (await hasApproval(tx, row.id, stage));
  const approvalRequested =
    approvalRequired &&
    !currentStageApproved &&
    Boolean(records.get(stage)?.approvalRequestedAt);

  const lineItems = (await loadLineItems(tx, [row.id])).get(row.id) ?? [];

  return {
    ...toSummary(
      row,
      org.access,
      lineItems,
      records.get("quotation"),
      assigned?.fullName ?? null,
    ),
    closeReason: row.closeReason,
    closedAt: row.closedAt?.toISOString() ?? null,
    source: row.source === "reception_visitor" ? "reception_visitor" : "admin",
    createdByName,
    steps,
    lineItems,
    bankAccounts: await loadBankAccounts(tx, org.id),
    attachments: await listAttachments(tx, row.id),
    approvalRequested,
    currentStageApproved,
    canApproveCurrentStage:
      approvalRequested && isApprover(org, approvers[stage]),
    canClose: status !== "completed" && can.assignInquiry(org.access, ownerOf(row)),
    comments,
    activityLogs,
  };
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
    if (!row || !canView(org, await loadWorkflow(tx, org.id), row)) {
      return null;
    }
    return loadInquiryView(tx, org, row);
  });
}

/* --------------------------------- writing -------------------------------- */

/** Something that happened to an inquiry; a step change when `to` differs. */
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

/**
 * An approval only covers what was approved; a change after it voids it, and
 * the step has to be sent for approval again.
 */
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
  await tx
    .update(inquiryStageRecords)
    .set({ approvalRequestedAt: null })
    .where(
      and(
        eq(inquiryStageRecords.inquiryId, inquiryId),
        eq(inquiryStageRecords.stageKey, stage),
      ),
    );

  if (cleared.length > 0) {
    await recordEvent(tx, org, userId, inquiryId, {
      from: stage,
      to: stage,
      note: `Approval cleared: ${reason}`,
    });
  }
}

/** Create or change the saved record of one step. */
async function writeStageRecord(
  tx: DbTransaction,
  org: ResolvedOrg,
  inquiryId: string,
  stage: InquiryStageKey,
  values: Partial<
    Pick<
      StageRecordRow,
      | "fields"
      | "tables"
      | "documentNumber"
      | "documentNumbers"
      | "handledByStaffId"
      | "bank"
      | "approvalRequestedAt"
      | "template"
      | "completedAt"
      | "completedByUserId"
    >
  >,
) {
  await tx
    .insert(inquiryStageRecords)
    .values({ organizationId: org.id, inquiryId, stageKey: stage, ...values })
    .onConflictDoUpdate({
      target: [inquiryStageRecords.inquiryId, inquiryStageRecords.stageKey],
      set: { ...values, updatedAt: new Date() },
    });
}

/**
 * Save the job's items the way the step allows: the Inquiry lists them with
 * quantity and price, the Quotation adds units, and the Delivery Note
 * records what was delivered. Every step may also write its own details
 * against an item (a remark, a heat number); nothing else is changed.
 */
async function saveLineItems(
  tx: DbTransaction,
  inquiryId: string,
  stage: InquiryStageKey,
  items: InquiryLineItemInput[],
) {
  const { items: mode, itemDetails } = STAGE_DEFINITIONS[stage];
  const existing = await tx
    .select()
    .from(inquiryLineItems)
    .where(eq(inquiryLineItems.inquiryId, inquiryId));
  const byId = new Map(existing.map((row) => [row.id, row]));
  const now = new Date();

  /** The item's details with this step's own ones replaced. */
  const mergedDetails = (
    current: Record<string, string>,
    item: InquiryLineItemInput,
  ) => ({
    ...current,
    ...Object.fromEntries(
      itemDetails.map(({ key }) => [key, item.details[key] ?? ""]),
    ),
  });

  if (mode === "delivery" || mode === "fixed") {
    for (const item of items) {
      const row = item.id ? byId.get(item.id) : undefined;
      if (!row) continue;
      await tx
        .update(inquiryLineItems)
        .set({
          ...(mode === "delivery"
            ? { deliveredQuantity: item.deliveredQuantity || null }
            : {}),
          details: mergedDetails(row.details, item),
          updatedAt: now,
        })
        .where(eq(inquiryLineItems.id, row.id));
    }
    return;
  }

  const kept = new Set(
    items.flatMap((item) => (item.id && byId.has(item.id) ? [item.id] : [])),
  );
  const removed = existing.filter((row) => !kept.has(row.id));
  if (removed.length > 0) {
    await tx.delete(inquiryLineItems).where(
      inArray(
        inquiryLineItems.id,
        removed.map((row) => row.id),
      ),
    );
  }

  for (const [index, item] of items.entries()) {
    const values = {
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      sortOrder: index,
      // Units are written on the quotation; the Inquiry leaves them alone.
      ...(mode === "priced" ? { unit: item.unit } : {}),
    };
    if (item.id && kept.has(item.id)) {
      await tx
        .update(inquiryLineItems)
        .set({ ...values, updatedAt: now })
        .where(eq(inquiryLineItems.id, item.id));
    } else {
      await tx.insert(inquiryLineItems).values({ inquiryId, ...values });
    }
  }
}

/** The next number for a step, or nothing for a step that has none. */
async function nextStageNumber(
  tx: DbTransaction,
  org: ResolvedOrg,
  stage: InquiryStageKey,
): Promise<string> {
  const counterKey = stageCounterKey(stage);
  if (!counterKey) return "";
  // The code is set on the step's main paper, or on the step itself.
  const template = (await loadStepTemplates(tx, org.id))[stage];
  const owner = mainDocument(stage)?.key ?? STEP_FORM;
  return nextDocumentNumber(
    tx,
    org,
    counterKey,
    numberCode(counterKey, template?.[owner]),
  );
}

/**
 * The details of the bank account a paper was saved with. They are copied
 * onto the step, so the paper keeps printing the account it was issued with
 * whatever happens to the company's list of accounts afterwards.
 */
async function chosenBank(
  tx: DbTransaction,
  org: ResolvedOrg,
  fields: Record<string, string>,
  saved: { fields: Record<string, string>; bank: BankDetails | null } | undefined,
): Promise<BankDetails | null> {
  const accountId = fields[BANK_FIELD];
  if (!accountId) return null;

  const account = (await loadBankAccounts(tx, org.id)).find(
    (item) => item.id === accountId,
  );
  if (account) {
    return {
      bankName: account.bankName,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      iban: account.iban,
      swift: account.swift,
      branch: account.branch,
    };
  }
  // An account no longer in use stays on a paper that already carried it.
  if (saved?.bank && saved.fields[BANK_FIELD] === accountId) return saved.bank;
  throw new UserError(
    "That bank account is no longer in use. Choose another one.",
  );
}

/** Save what was typed into one step. Returns the answers as stored. */
async function saveStageAnswers(
  tx: DbTransaction,
  org: ResolvedOrg,
  row: InquiryRow,
  stage: InquiryStageKey,
  input: InquiryStageInput,
): Promise<Record<string, string>> {
  const fields = normalizeStageFields(stage, input.fields);
  const items = normalizeLineItems(input.lineItems);

  if (stage === "inquiry") {
    if (!fields.customerName) {
      throw new UserError("Enter the customer's name.");
    }
    // A job is local unless it is said to be for export.
    fields.jobType = fields.jobType || "local";
    await tx
      .update(inquiries)
      .set({
        customerName: fields.customerName,
        contact: fields.contact ?? "",
        title: fields.title ?? "",
        jobType: fields.jobType,
        deliveryExpectedOn: fields.deliveryExpectedOn ?? "",
        notes: fields.details ?? "",
        updatedAt: new Date(),
      })
      .where(eq(inquiries.id, row.id));
  } else {
    await tx
      .update(inquiries)
      .set({ updatedAt: new Date() })
      .where(eq(inquiries.id, row.id));
  }

  // Each document of the step gets its number the first time the step is
  // saved with that document in use.
  const [record] = await tx
    .select({
      documentNumber: inquiryStageRecords.documentNumber,
      documentNumbers: inquiryStageRecords.documentNumbers,
      fields: inquiryStageRecords.fields,
      bank: inquiryStageRecords.bank,
    })
    .from(inquiryStageRecords)
    .where(
      and(
        eq(inquiryStageRecords.inquiryId, row.id),
        eq(inquiryStageRecords.stageKey, stage),
      ),
    )
    .limit(1);
  const main = mainDocument(stage);
  const documentNumbers = { ...(record?.documentNumbers ?? {}) };
  // A paper without a code of its own carries the number of its step.
  const unnumbered = documentsInUse(stage, fields).filter(
    (doc) =>
      doc.key !== main?.key && doc.counterKey && !documentNumbers[doc.key],
  );
  if (unnumbered.length > 0) {
    const template = (await loadStepTemplates(tx, org.id))[stage];
    for (const doc of unnumbered) {
      documentNumbers[doc.key] = await nextDocumentNumber(
        tx,
        org,
        doc.counterKey!,
        numberCode(doc.counterKey!, template?.[doc.key]),
      );
    }
  }

  // A name the papers are printed under must be one of the company's own.
  // One that is no longer offered stays on a step that already carried it.
  const letterhead = fields[LETTERHEAD_FIELD];
  if (letterhead && record?.fields[LETTERHEAD_FIELD] !== letterhead) {
    const names = await loadLetterheads(tx, org.id);
    if (!names.some((item) => item.id === letterhead && item.active)) {
      throw new UserError(
        "That name is no longer in use. Choose another one to print under.",
      );
    }
  }

  await writeStageRecord(tx, org, row.id, stage, {
    fields:
      stage === "inquiry"
        ? Object.fromEntries(
            Object.entries(fields).filter(
              ([key]) => !INQUIRY_HEADER_FIELDS.has(key),
            ),
          )
        : fields,
    tables: normalizeStageTables(stage, input.tables),
    documentNumbers,
    ...(STAGE_DEFINITIONS[stage].fields.some(
      (field) => field.key === BANK_FIELD,
    )
      ? { bank: await chosenBank(tx, org, fields, record) }
      : {}),
    // Normally given when the job reached the step; older inquiries get it
    // here.
    ...(stage !== "inquiry" && !record?.documentNumber
      ? { documentNumber: await nextStageNumber(tx, org, stage) }
      : {}),
  });
  await saveLineItems(tx, row.id, stage, items);
  await keepOnlyAttachments(
    tx,
    row.id,
    stage,
    STAGE_DEFINITIONS[stage].fields.flatMap((field) =>
      field.type === "file" && fields[field.key] ? [fields[field.key]!] : [],
    ),
  );

  return fields;
}

/** Everything an approval covers, to tell whether a save changed it. */
async function approvedContent(
  tx: DbTransaction,
  inquiryId: string,
  stage: InquiryStageKey,
): Promise<string> {
  const [row] = await tx
    .select()
    .from(inquiries)
    .where(eq(inquiries.id, inquiryId))
    .limit(1);
  const record = (await loadStageRecords(tx, [inquiryId], stage))
    .get(inquiryId)
    ?.get(stage);
  const items = (await loadLineItems(tx, [inquiryId])).get(inquiryId) ?? [];
  return JSON.stringify([
    row && stage === "inquiry" ? inquiryStepFields(row, record) : record?.fields,
    record?.tables,
    items,
  ]);
}

async function insertInquiry(
  tx: DbTransaction,
  org: ResolvedOrg,
  userId: string,
  values: {
    customerName: string;
    notes: string;
    source: "admin" | "reception_visitor";
    sourceVisitorId?: string;
  },
): Promise<InquiryRow> {
  const map = await loadWorkflowMap(tx, org.id);
  const template = (await loadStepTemplates(tx, org.id)).inquiry;
  const [row] = await tx
    .insert(inquiries)
    .values({
      organizationId: org.id,
      inquiryNumber: await nextDocumentNumber(
        tx,
        org,
        INQUIRY_COUNTER_KEY,
        numberCode(INQUIRY_COUNTER_KEY, template?.[STEP_FORM]),
      ),
      customerName: values.customerName,
      notes: values.notes,
      currentStage: "inquiry",
      owningDepartmentKey: departmentForStage(map, "inquiry"),
      source: values.source,
      sourceVisitorId: values.sourceVisitorId ?? null,
      createdByUserId: userId,
    })
    .returning();
  await recordEvent(tx, org, userId, row!.id, { from: "", to: "inquiry" });

  return row!;
}

export async function createInquiryForUser(
  userId: string,
  orgCode: string,
  input: InquiryStageInput,
): Promise<InquiryView> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    assertCan(can.createInquiry(org.access));

    const customerName = String(input.fields?.customerName ?? "").trim();
    if (!customerName) {
      throw new UserError("Enter the customer's name.");
    }
    const row = await insertInquiry(tx, org, userId, {
      customerName,
      notes: "",
      source: "admin",
    });
    await saveStageAnswers(tx, org, row, "inquiry", input);

    return reloadInquiryView(tx, org, row.id);
  });
}

/** A walk-in logged at Reception with purpose "Inquiry" starts an inquiry. */
export async function createStarterInquiryInTx(
  tx: DbTransaction,
  org: ResolvedOrg,
  userId: string,
  visitor: { id: string; fullName: string; notes: string },
): Promise<string> {
  const row = await insertInquiry(tx, org, userId, {
    customerName: visitor.fullName,
    notes: visitor.notes,
    source: "reception_visitor",
    sourceVisitorId: visitor.id,
  });

  await tx
    .update(visitorLogs)
    .set({ inquiryId: row.id, updatedAt: new Date() })
    .where(eq(visitorLogs.id, visitor.id));

  return row.id;
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
  requireOpen(row);
  if (!row.assignedStaffId) throw new UserError(unassignedMessage);
  return row;
}

function requireOpen(row: InquiryRow) {
  if (statusOf(row) !== "open") {
    throw new UserError("This inquiry is closed.");
  }
}

/**
 * Refuse unless everything the step needs has been filled in. Returns the
 * company's version of the step's papers that it was checked against.
 */
async function assertStageComplete(
  tx: DbTransaction,
  org: ResolvedOrg,
  inquiryId: string,
  stage: InquiryStageKey,
  fields: Record<string, string>,
): Promise<StepTemplate> {
  const template = (await loadStepTemplates(tx, org.id))[stage] ?? {};
  const missing = missingStageFields(stage, fields, template);
  if (missing.length > 0) {
    throw new UserError(
      `Still needed: ${missing.map((field) => field.label).join(", ")}.`,
    );
  }
  const items = (await loadLineItems(tx, [inquiryId])).get(inquiryId) ?? [];
  const mode = STAGE_DEFINITIONS[stage].items;
  if (mode === "priced" && !items.some((item) => Number(item.unitPrice) > 0)) {
    throw new UserError("Add at least one priced item to the quotation.");
  }
  if (mode === "delivery" && items.some((item) => !item.deliveredQuantity)) {
    throw new UserError("Enter the delivered quantity for every item.");
  }
  return template;
}

/**
 * Save the current step. With `complete`, also finish it and hand the
 * inquiry to the next step, whose department then assigns its own person.
 * Completing the last step closes the inquiry.
 */
export async function saveInquiryStageForUser(
  userId: string,
  orgCode: string,
  inquiryId: string,
  input: InquiryStageInput,
  options: { complete: boolean },
): Promise<InquiryView> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    const existing = await requireWorkableInquiry(
      tx,
      org,
      inquiryId,
      "Assign someone before working on this step.",
    );
    const stage = stageOf(existing);

    const before = await approvedContent(tx, inquiryId, stage);
    const fields = await saveStageAnswers(tx, org, existing, stage, input);
    if ((await approvedContent(tx, inquiryId, stage)) !== before) {
      await clearApproval(tx, org, userId, inquiryId, stage, "step changed");
    }
    if (!options.complete) return reloadInquiryView(tx, org, inquiryId);

    const template = await assertStageComplete(
      tx,
      org,
      inquiryId,
      stage,
      fields,
    );

    const { map, approvers } = await loadWorkflow(tx, org.id);
    if (approvers[stage] && !(await hasApproval(tx, inquiryId, stage))) {
      throw new UserError(
        `Approval required by ${approvers[stage].label} before moving to the next step.`,
      );
    }

    await writeStageRecord(tx, org, inquiryId, stage, {
      handledByStaffId: existing.assignedStaffId,
      // From here on the step's papers stay as they are now, whatever the
      // company changes about them later.
      template,
      completedAt: new Date(),
      completedByUserId: userId,
    });

    const next = adjacentInquiryStages(stage, existing.jobType).next;
    if (next) {
      await enterStage(tx, org, userId, existing, next, map);
    } else {
      await tx
        .update(inquiries)
        .set({
          status: "completed",
          closedAt: new Date(),
          assignedStaffId: null,
          updatedAt: new Date(),
        })
        .where(eq(inquiries.id, inquiryId));
      await recordEvent(tx, org, userId, inquiryId, {
        from: stage,
        to: stage,
        note: "Inquiry completed",
      });
    }

    return reloadInquiryView(tx, org, inquiryId);
  });
}

/**
 * Move an inquiry to another step. A step that is new to this inquiry starts
 * unassigned; one that was worked on before goes back to whoever handled it,
 * if they are still in that department.
 */
async function enterStage(
  tx: DbTransaction,
  org: ResolvedOrg,
  userId: string,
  row: InquiryRow,
  toStage: InquiryStageKey,
  map: InquiryWorkflowMap,
  note = "",
) {
  const owner = departmentForStage(map, toStage);
  const [record] = await tx
    .select({
      handledByStaffId: inquiryStageRecords.handledByStaffId,
      documentNumber: inquiryStageRecords.documentNumber,
    })
    .from(inquiryStageRecords)
    .where(
      and(
        eq(inquiryStageRecords.inquiryId, row.id),
        eq(inquiryStageRecords.stageKey, toStage),
      ),
    )
    .limit(1);
  const previousHandler = record?.handledByStaffId
    ? (await loadAssignableStaff(tx, org.id, owner)).find(
        (staff) => staff.id === record.handledByStaffId,
      )
    : undefined;

  await tx
    .update(inquiries)
    .set({
      currentStage: toStage,
      owningDepartmentKey: owner,
      assignedStaffId: previousHandler?.id ?? null,
      stageEnteredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(inquiries.id, row.id));
  // The step has its number from the moment the job reaches it.
  if (!record?.documentNumber) {
    await writeStageRecord(tx, org, row.id, toStage, {
      documentNumber: await nextStageNumber(tx, org, toStage),
    });
  }
  await recordEvent(tx, org, userId, row.id, {
    from: stageOf(row),
    to: toStage,
    note,
  });
}

/**
 * A person can no longer work some of the jobs they hold, because they left
 * the company or the department. Those jobs go back to their department,
 * for someone there to take, and the job's history says why. `stillIn` is
 * the departments the person still works in.
 */
export async function releaseInquiriesOf(
  tx: DbTransaction,
  org: ResolvedOrg,
  userId: string,
  staff: { id: string; fullName: string },
  stillIn: ReadonlySet<string>,
): Promise<number> {
  const held = await tx
    .select()
    .from(inquiries)
    .where(
      and(
        eq(inquiries.organizationId, org.id),
        eq(inquiries.assignedStaffId, staff.id),
      ),
    );

  let released = 0;
  for (const row of held) {
    if (statusOf(row) !== "open" || stillIn.has(ownerOf(row))) continue;
    await tx
      .update(inquiries)
      .set({ assignedStaffId: null, updatedAt: new Date() })
      .where(eq(inquiries.id, row.id));
    await recordEvent(tx, org, userId, row.id, {
      from: stageOf(row),
      to: stageOf(row),
      note: `Unassigned: ${staff.fullName} no longer works in ${workflowDepartmentLabel(ownerOf(row))}`,
    });
    released += 1;
  }
  return released;
}

/** Return an inquiry to the step before, saying what has to be fixed. */
export async function sendInquiryBackForUser(
  userId: string,
  orgCode: string,
  inquiryId: string,
  reason: string,
): Promise<InquiryView> {
  const why = reason.trim();
  if (!why) {
    throw new UserError("Say why it is being sent back.");
  }

  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    const existing = await requireWorkableInquiry(
      tx,
      org,
      inquiryId,
      "Assign someone before sending this back.",
    );
    const stage = stageOf(existing);
    const previous = adjacentInquiryStages(stage, existing.jobType).previous;
    if (!previous) {
      throw new UserError("This is the first step.");
    }

    // The earlier step is open again, so it must be approved again.
    await clearApproval(tx, org, userId, inquiryId, previous, "sent back");
    await writeStageRecord(tx, org, inquiryId, previous, {
      // Open again, so it follows the papers as they are set up now.
      template: null,
      completedAt: null,
      completedByUserId: null,
    });
    await writeStageRecord(tx, org, inquiryId, stage, {
      handledByStaffId: existing.assignedStaffId,
    });
    await enterStage(
      tx,
      org,
      userId,
      existing,
      previous,
      await loadWorkflowMap(tx, org.id),
      `Sent back: ${why}`,
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
    throw new UserError("Enter a note.");
  }

  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    // Anyone who can open the inquiry can leave a note on it.
    await requireInquiry(tx, org, inquiryId);

    await tx.insert(inquiryComments).values({
      organizationId: org.id,
      inquiryId,
      authorUserId: userId,
      body: text,
    });

    return reloadInquiryView(tx, org, inquiryId);
  });
}

/** Active staff of each department the user may assign work in. */
export async function listAssignableStaffForUser(
  userId: string,
  orgCode: string,
): Promise<Partial<Record<InquiryWorkflowDepartmentKey, AssignableStaff[]>>> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org) return {};

    const staff: Partial<
      Record<InquiryWorkflowDepartmentKey, AssignableStaff[]>
    > = {};
    for (const department of INQUIRY_WORKFLOW_DEPARTMENTS) {
      if (!can.assignInquiry(org.access, department.key)) continue;
      staff[department.key] = await loadAssignableStaff(
        tx,
        org.id,
        department.key,
      );
    }
    return staff;
  });
}

async function loadAssignableStaff(
  tx: DbTransaction,
  organizationId: string,
  departmentKey: InquiryWorkflowDepartmentKey,
): Promise<AssignableStaff[]> {
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
    requireOpen(existing);

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
    // Kept on the step itself, so every step has its own person on record.
    await writeStageRecord(tx, org, inquiryId, stage, {
      handledByStaffId: staffId,
    });
    await recordEvent(tx, org, userId, inquiryId, {
      from: stage,
      to: stage,
      note: `Assigned to ${assignee.fullName}`,
    });

    return reloadInquiryView(tx, org, inquiryId);
  });
}

/**
 * Say who will handle a step the job has not reached yet, or take that back
 * with an empty `staffId`. When the job gets to the step it goes straight to
 * that person, if they are still in the step's department.
 */
export async function planInquiryStepForUser(
  userId: string,
  orgCode: string,
  inquiryId: string,
  stage: string,
  staffId: string,
): Promise<InquiryView> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    const existing = await requireInquiry(tx, org, inquiryId);
    requireOpen(existing);

    const stages = stagesForJob(existing.jobType);
    const index = stages.findIndex((item) => item.key === stage);
    const current = stages.findIndex((item) => item.key === stageOf(existing));
    if (index === -1 || index <= current) {
      throw new UserError("Only a step still to come can be planned.");
    }
    const target = stages[index]!;
    const owner = departmentForStage(
      await loadWorkflowMap(tx, org.id),
      target.key,
    );
    assertCan(can.assignInquiry(org.access, owner));

    const person = staffId
      ? (await loadAssignableStaff(tx, org.id, owner)).find(
          (staff) => staff.id === staffId,
        )
      : null;
    if (staffId && !person) {
      throw new UserError(
        "Select an active staff member from the step's department.",
      );
    }

    await writeStageRecord(tx, org, inquiryId, target.key, {
      handledByStaffId: person?.id ?? null,
    });
    const now = stageOf(existing);
    await recordEvent(tx, org, userId, inquiryId, {
      from: now,
      to: now,
      note: person
        ? `${target.label} planned for ${person.fullName}`
        : `${target.label} no longer planned for anyone`,
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
    requireOpen(existing);
    if (!existing.assignedStaffId) {
      throw new UserError("Assign a person before approving this step.");
    }

    const stage = stageOf(existing);
    const approver = (await loadWorkflow(tx, org.id)).approvers[stage];
    if (!approver) {
      throw new UserError("This step does not require approval.");
    }
    if (!isApprover(org, approver)) {
      throw new UserError(`Only ${approver.label} can approve this step.`);
    }
    if (await hasApproval(tx, inquiryId, stage)) {
      throw new UserError("This step is already approved.");
    }
    const record = (await loadStageRecords(tx, [inquiryId], stage))
      .get(inquiryId)
      ?.get(stage);
    if (!record?.approvalRequestedAt) {
      throw new UserError("This step has not been sent for approval yet.");
    }

    await tx.insert(inquiryStageApprovals).values({
      organizationId: org.id,
      inquiryId,
      stageKey: stage,
      requiredBy: approver.key,
      approvedByUserId: userId,
    });
    await writeStageRecord(tx, org, inquiryId, stage, {
      approvalRequestedAt: null,
    });
    await recordEvent(tx, org, userId, inquiryId, {
      from: stage,
      to: stage,
      note: `Approved by ${approver.label}`,
    });

    return reloadInquiryView(tx, org, inquiryId);
  });
}

/**
 * Save the current step and send it for approval. It has to be complete:
 * the approver approves what will move on, not a draft.
 */
export async function requestInquiryApprovalForUser(
  userId: string,
  orgCode: string,
  inquiryId: string,
  input: InquiryStageInput,
): Promise<InquiryView> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    const existing = await requireWorkableInquiry(
      tx,
      org,
      inquiryId,
      "Assign someone before working on this step.",
    );
    const stage = stageOf(existing);
    const approver = (await loadWorkflow(tx, org.id)).approvers[stage];
    if (!approver) {
      throw new UserError("This step does not require approval.");
    }

    const fields = await saveStageAnswers(tx, org, existing, stage, input);
    await assertStageComplete(tx, org, inquiryId, stage, fields);
    // Whatever was approved before, this is a new version to approve.
    await clearApproval(tx, org, userId, inquiryId, stage, "sent again");
    await writeStageRecord(tx, org, inquiryId, stage, {
      approvalRequestedAt: new Date(),
    });
    await recordEvent(tx, org, userId, inquiryId, {
      from: stage,
      to: stage,
      note: `Sent to ${approver.label} for approval`,
    });

    return reloadInquiryView(tx, org, inquiryId);
  });
}

/**
 * Take a step back from approval so it can be changed: by the person
 * handling it, or by the approver who wants something changed first.
 */
export async function reopenInquiryStepForUser(
  userId: string,
  orgCode: string,
  inquiryId: string,
  reason: string,
): Promise<InquiryView> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    const existing = await requireInquiry(tx, org, inquiryId);
    requireOpen(existing);

    const stage = stageOf(existing);
    const { approvers } = await loadWorkflow(tx, org.id);
    assertCan(
      isApprover(org, approvers[stage]) ||
        can.workInquiry(org.access, ownerOf(existing)),
    );

    const why = reason.trim();
    await clearApproval(tx, org, userId, inquiryId, stage, "opened for changes");
    await recordEvent(tx, org, userId, inquiryId, {
      from: stage,
      to: stage,
      note: why ? `Changes asked for: ${why}` : "Opened again for changes",
    });

    return reloadInquiryView(tx, org, inquiryId);
  });
}

/** Close an inquiry that is not going ahead, keeping everything recorded. */
export async function closeInquiryForUser(
  userId: string,
  orgCode: string,
  inquiryId: string,
  reason: string,
): Promise<InquiryView> {
  const why = reason.trim();
  if (!why) {
    throw new UserError("Say why this inquiry is being closed.");
  }

  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    const existing = await requireInquiry(tx, org, inquiryId);
    assertCan(can.assignInquiry(org.access, ownerOf(existing)));
    requireOpen(existing);

    await tx
      .update(inquiries)
      .set({
        status: "cancelled",
        closeReason: why,
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(inquiries.id, inquiryId));
    const stage = stageOf(existing);
    await recordEvent(tx, org, userId, inquiryId, {
      from: stage,
      to: stage,
      note: `Closed as lost: ${why}`,
    });

    return reloadInquiryView(tx, org, inquiryId);
  });
}

/** Bring a closed-as-lost inquiry back to the step it stopped at. */
export async function reopenInquiryForUser(
  userId: string,
  orgCode: string,
  inquiryId: string,
): Promise<InquiryView> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    const existing = await requireInquiry(tx, org, inquiryId);
    assertCan(can.assignInquiry(org.access, ownerOf(existing)));
    if (statusOf(existing) !== "cancelled") {
      throw new UserError("Only an inquiry closed as lost can be reopened.");
    }

    await tx
      .update(inquiries)
      .set({
        status: "open",
        closeReason: "",
        closedAt: null,
        stageEnteredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(inquiries.id, inquiryId));
    const stage = stageOf(existing);
    await recordEvent(tx, org, userId, inquiryId, {
      from: stage,
      to: stage,
      note: "Reopened",
    });

    return reloadInquiryView(tx, org, inquiryId);
  });
}

/* ---------------------------------- files --------------------------------- */

/**
 * Upload a file to the current step, such as the customer's LPO. It becomes
 * part of the step when the step is saved with it.
 */
export async function uploadInquiryAttachmentForUser(
  userId: string,
  orgCode: string,
  inquiryId: string,
  input: { fileName: string; dataUrl: string },
): Promise<AttachmentView> {
  const file = readUploadedFile(input);

  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    const existing = await requireWorkableInquiry(
      tx,
      org,
      inquiryId,
      "Assign someone before working on this step.",
    );
    return insertAttachment(tx, {
      organizationId: org.id,
      inquiryId,
      stageKey: stageOf(existing),
      uploadedByUserId: userId,
      ...file,
    });
  });
}

/** A file of an inquiry, for whoever may open that inquiry. */
export async function getInquiryAttachmentForUser(
  userId: string,
  orgCode: string,
  attachmentId: string,
): Promise<{ fileName: string; contentType: string; bytes: Buffer } | null> {
  const file = await loadAttachmentFile(userId, attachmentId);
  if (!file) return null;
  // The inquiry is only returned to people allowed to see it.
  const inquiry = await getInquiryForUser(userId, orgCode, file.inquiryId);
  if (!inquiry) return null;
  return {
    fileName: file.fileName,
    contentType: file.contentType,
    bytes: Buffer.from(file.content, "base64"),
  };
}
