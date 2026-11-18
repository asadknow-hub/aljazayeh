import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { withTenantContext } from "@/db/client";
import {
  staffMembers,
  vacationRequests,
} from "@/db/schema";
import { assertCan, can } from "@/lib/access/access";
import { insertStaffActivityLog } from "@/lib/activity/record";
import { requireOrg, resolveOrg } from "@/lib/org/resolve";
import {
  leaveTypeLabel,
  parseSelectedDatesJson,
  type LeaveType,
  type VacationRequestInput,
  type VacationRequestView,
  type VacationStatus,
} from "@/lib/vacation/types";
import { normalizeVacationRequestInput } from "@/lib/vacation/validate";
import { UserError } from "@/lib/errors";

function toView(
  row: typeof vacationRequests.$inferSelect,
  staffName: string,
  staffJobTitle: string,
): VacationRequestView {
  const selectedDates = parseSelectedDatesJson(row.selectedDates);
  return {
    id: row.id,
    organizationId: row.organizationId,
    staffId: row.staffId,
    staffName,
    staffJobTitle,
    startDate: row.startDate,
    endDate: row.endDate,
    selectedDates,
    dayCount: row.dayCount || selectedDates.length,
    leaveType: row.leaveType as LeaveType,
    reason: row.reason,
    status: row.status as VacationStatus,
    requestedByUserId: row.requestedByUserId,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPendingVacationRequestsForUser(
  userId: string,
  orgCode: string,
): Promise<VacationRequestView[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.reviewLeave(org.access)) return [];

    const rows = await tx
      .select({
        request: vacationRequests,
        staffName: staffMembers.fullName,
        staffJobTitle: staffMembers.jobTitle,
      })
      .from(vacationRequests)
      .innerJoin(staffMembers, eq(staffMembers.id, vacationRequests.staffId))
      .where(
        and(
          eq(vacationRequests.organizationId, org.id),
          eq(vacationRequests.status, "pending"),
        ),
      )
      .orderBy(asc(vacationRequests.startDate), asc(staffMembers.fullName));

    return rows.map((row) =>
      toView(row.request, row.staffName, row.staffJobTitle),
    );
  });
}

export async function listOrgVacationRequestsForUser(
  userId: string,
  orgCode: string,
): Promise<VacationRequestView[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.useReception(org.access)) return [];

    const rows = await tx
      .select({
        request: vacationRequests,
        staffName: staffMembers.fullName,
        staffJobTitle: staffMembers.jobTitle,
      })
      .from(vacationRequests)
      .innerJoin(staffMembers, eq(staffMembers.id, vacationRequests.staffId))
      .where(eq(vacationRequests.organizationId, org.id))
      .orderBy(
        desc(vacationRequests.createdAt),
        asc(staffMembers.fullName),
      );

    return rows.map((row) =>
      toView(row.request, row.staffName, row.staffJobTitle),
    );
  });
}

export async function listStaffVacationRequestsForUser(
  userId: string,
  orgCode: string,
  staffId: string,
): Promise<VacationRequestView[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.manageStaff(org.access)) return [];

    const [staff] = await tx
      .select({
        id: staffMembers.id,
        fullName: staffMembers.fullName,
        jobTitle: staffMembers.jobTitle,
      })
      .from(staffMembers)
      .where(
        and(
          eq(staffMembers.id, staffId),
          eq(staffMembers.organizationId, org.id),
        ),
      )
      .limit(1);

    if (!staff) return [];

    const rows = await tx
      .select()
      .from(vacationRequests)
      .where(
        and(
          eq(vacationRequests.organizationId, org.id),
          eq(vacationRequests.staffId, staffId),
        ),
      )
      .orderBy(desc(vacationRequests.startDate), desc(vacationRequests.createdAt));

    return rows.map((row) => toView(row, staff.fullName, staff.jobTitle));
  });
}

export async function createVacationRequestForUser(
  userId: string,
  orgCode: string,
  input: VacationRequestInput,
): Promise<VacationRequestView> {
  const normalized = normalizeVacationRequestInput(input);

  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    assertCan(can.useReception(org.access));

    const [staff] = await tx
      .select()
      .from(staffMembers)
      .where(
        and(
          eq(staffMembers.id, normalized.staffId),
          eq(staffMembers.organizationId, org.id),
        ),
      )
      .limit(1);

    if (!staff) {
      throw new UserError("Employee not found.");
    }

    const id = crypto.randomUUID();
    const now = new Date();

    await tx.insert(vacationRequests).values({
      id,
      organizationId: org.id,
      staffId: staff.id,
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      selectedDates: JSON.stringify(normalized.selectedDates),
      dayCount: normalized.dayCount,
      leaveType: normalized.leaveType,
      reason: normalized.reason,
      status: "pending",
      requestedByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });

    await insertStaffActivityLog(tx, {
      organizationId: org.id,
      staffId: staff.id,
      occurredAt: now,
      category: "vacation",
      action: "requested",
      summary: "Vacation requested",
      details: normalized.reason
        ? `${leaveTypeLabel(normalized.leaveType)} · ${normalized.reason}`
        : leaveTypeLabel(normalized.leaveType),
      status: "pending",
      dayCount: normalized.dayCount,
      referenceType: "vacation_request",
      referenceId: id,
      actorUserId: userId,
    });

    const [row] = await tx
      .select()
      .from(vacationRequests)
      .where(eq(vacationRequests.id, id))
      .limit(1);

    if (!row) {
      throw new UserError("Could not create vacation request.");
    }

    return toView(row, staff.fullName, staff.jobTitle);
  });
}

export async function reviewVacationRequestForUser(
  userId: string,
  orgCode: string,
  requestId: string,
  decision: "approved" | "rejected",
  reviewNote = "",
): Promise<VacationRequestView> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    assertCan(can.reviewLeave(org.access));

    const [existing] = await tx
      .select({
        request: vacationRequests,
        staffName: staffMembers.fullName,
        staffJobTitle: staffMembers.jobTitle,
      })
      .from(vacationRequests)
      .innerJoin(staffMembers, eq(staffMembers.id, vacationRequests.staffId))
      .where(
        and(
          eq(vacationRequests.id, requestId),
          eq(vacationRequests.organizationId, org.id),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new UserError("Vacation request not found.");
    }

    if (existing.request.status !== "pending") {
      throw new UserError("This request has already been processed.");
    }

    const now = new Date();
    await tx
      .update(vacationRequests)
      .set({
        status: decision,
        reviewedByUserId: userId,
        reviewedAt: now,
        reviewNote: reviewNote.trim(),
        updatedAt: now,
      })
      .where(eq(vacationRequests.id, requestId));

    await insertStaffActivityLog(tx, {
      organizationId: org.id,
      staffId: existing.request.staffId,
      occurredAt: now,
      category: "vacation",
      action: decision,
      summary:
        decision === "approved" ? "Vacation approved" : "Vacation rejected",
      details: existing.request.reason
        ? `${leaveTypeLabel(existing.request.leaveType)} · ${existing.request.reason}`
        : leaveTypeLabel(existing.request.leaveType),
      status: decision,
      dayCount: existing.request.dayCount,
      referenceType: "vacation_request",
      referenceId: requestId,
      actorUserId: userId,
    });

    const [row] = await tx
      .select()
      .from(vacationRequests)
      .where(eq(vacationRequests.id, requestId))
      .limit(1);

    if (!row) {
      throw new UserError("Could not update vacation request.");
    }

    return toView(row, existing.staffName, existing.staffJobTitle);
  });
}
