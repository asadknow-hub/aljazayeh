import "server-only";

import { and, desc, eq, gte, lt, lte, ne } from "drizzle-orm";
import { withTenantContext, type DbTransaction } from "@/db/client";
import {
  organizationSettings,
  staffDepartmentAssignments,
  staffMembers,
  vacationRequests,
} from "@/db/schema";
import { assertCan, can } from "@/lib/access/access";
import { insertStaffActivityLog } from "@/lib/activity/record";
import { addDays, durationInYearsAndMonths } from "@/lib/datetime/calendar";
import { departmentLabel } from "@/lib/departments/catalog";
import { UserError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { requireOrg, resolveOrg, type ResolvedOrg } from "@/lib/org/resolve";
import type { SignoffDecision } from "@/lib/signoffs/chains";
import { verifyApprovalPin } from "@/lib/signoffs/credentials";
import {
  assertChainStaffed,
  isSignerOf,
  loadSignoffState,
  signAsPreparer,
  signNextStep,
} from "@/lib/signoffs/queries";
import {
  leaveTypeLabel,
  type LeaveDocument,
  type LeaveType,
  type VacationRequestInput,
  type VacationRequestView,
  type VacationStatus,
} from "@/lib/vacation/types";
import { normalizeVacationRequestInput } from "@/lib/vacation/validate";

const DOCUMENT_TYPE = "leave_request";

type RequestRow = typeof vacationRequests.$inferSelect;

function toView(
  row: RequestRow,
  staff: { fullName: string; jobTitle: string },
): VacationRequestView {
  return {
    id: row.id,
    staffId: row.staffId,
    staffName: staff.fullName,
    staffJobTitle: staff.jobTitle,
    startDate: row.startDate,
    endDate: row.endDate,
    returnDate: addDays(row.endDate, 1),
    dayCount: row.dayCount,
    leaveType: row.leaveType as LeaveType,
    reason: row.reason,
    status: row.status as VacationStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadRequests(
  tx: DbTransaction,
  organizationId: string,
  filter: { staffId?: string; status?: VacationStatus } = {},
): Promise<VacationRequestView[]> {
  const rows = await tx
    .select({
      request: vacationRequests,
      fullName: staffMembers.fullName,
      jobTitle: staffMembers.jobTitle,
    })
    .from(vacationRequests)
    .innerJoin(staffMembers, eq(staffMembers.id, vacationRequests.staffId))
    .where(
      and(
        eq(vacationRequests.organizationId, organizationId),
        filter.staffId
          ? eq(vacationRequests.staffId, filter.staffId)
          : undefined,
        filter.status ? eq(vacationRequests.status, filter.status) : undefined,
      ),
    )
    .orderBy(desc(vacationRequests.createdAt));

  return rows.map((row) => toView(row.request, row));
}

/** Every leave request of the company, for Reception. */
export async function listOrgVacationRequestsForUser(
  userId: string,
  orgCode: string,
): Promise<VacationRequestView[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.useReception(org.access)) return [];
    return loadRequests(tx, org.id);
  });
}

/** One person's leave history, for their staff page. */
export async function listStaffVacationRequestsForUser(
  userId: string,
  orgCode: string,
  staffId: string,
): Promise<VacationRequestView[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.manageStaff(org.access) || !isUuid(staffId)) return [];
    return loadRequests(tx, org.id, { staffId });
  });
}

/** Leave requests whose next signature is the signed-in person's. */
export async function listVacationsAwaitingMySignature(
  userId: string,
  orgCode: string,
): Promise<VacationRequestView[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org) return [];

    const pending = await loadRequests(tx, org.id, { status: "pending" });
    const mine: VacationRequestView[] = [];
    for (const request of pending) {
      const state = await loadSignoffState(tx, org, DOCUMENT_TYPE, request.id);
      if (state.canSign) mine.push(request);
    }
    return mine;
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
    await assertChainStaffed(tx, org, DOCUMENT_TYPE);

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
    if (staff.joinedOn && normalized.startDate < staff.joinedOn) {
      throw new UserError("The leave starts before this person joined.");
    }

    // One leave at a time: nothing pending or approved may overlap.
    const [overlap] = await tx
      .select({ id: vacationRequests.id })
      .from(vacationRequests)
      .where(
        and(
          eq(vacationRequests.staffId, staff.id),
          ne(vacationRequests.status, "rejected"),
          lte(vacationRequests.startDate, normalized.endDate),
          gte(vacationRequests.endDate, normalized.startDate),
        ),
      )
      .limit(1);
    if (overlap) {
      throw new UserError(
        `${staff.fullName} already has a leave request covering some of these days.`,
      );
    }

    const [created] = await tx
      .insert(vacationRequests)
      .values({
        organizationId: org.id,
        staffId: staff.id,
        startDate: normalized.startDate,
        endDate: normalized.endDate,
        dayCount: normalized.dayCount,
        leaveType: normalized.leaveType,
        reason: normalized.reason,
        jobHandledBy: normalized.jobHandledBy,
        leaveAvailableDays: normalized.leaveAvailableDays,
        officeComments: normalized.officeComments,
        requestedByUserId: userId,
      })
      .returning();
    await signAsPreparer(tx, org, userId, DOCUMENT_TYPE, created!.id);

    await insertStaffActivityLog(tx, {
      organizationId: org.id,
      staffId: staff.id,
      category: "vacation",
      action: "requested",
      summary: "Vacation requested",
      details: describeLeave(created!),
      status: "pending",
      dayCount: normalized.dayCount,
      referenceType: "vacation_request",
      referenceId: created!.id,
      actorUserId: userId,
    });

    return toView(created!, staff);
  });
}

function describeLeave(row: RequestRow): string {
  const type = leaveTypeLabel(row.leaveType);
  return row.reason ? `${type} · ${row.reason}` : type;
}

async function findRequest(
  tx: DbTransaction,
  org: ResolvedOrg,
  requestId: string,
) {
  if (!isUuid(requestId)) return null;
  const [row] = await tx
    .select({ request: vacationRequests, staff: staffMembers })
    .from(vacationRequests)
    .innerJoin(staffMembers, eq(staffMembers.id, vacationRequests.staffId))
    .where(
      and(
        eq(vacationRequests.id, requestId),
        eq(vacationRequests.organizationId, org.id),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * The Leave Request Application form with its signatures. Open to Reception
 * and leadership, to the person the leave is for, and to whoever signs next.
 */
export async function getLeaveDocumentForUser(
  userId: string,
  orgCode: string,
  requestId: string,
): Promise<LeaveDocument | null> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org) return null;
    const found = await findRequest(tx, org, requestId);
    if (!found) return null;
    const { request, staff } = found;

    const signoffs = await loadSignoffState(tx, org, DOCUMENT_TYPE, request.id);
    const mayView =
      can.useReception(org.access) ||
      staff.id === org.access.staffId ||
      (await isSignerOf(tx, org, DOCUMENT_TYPE));
    if (!mayView) return null;

    const departments = await tx
      .select({ key: staffDepartmentAssignments.departmentKey })
      .from(staffDepartmentAssignments)
      .where(eq(staffDepartmentAssignments.staffId, staff.id));

    const [previous] = await tx
      .select({ endDate: vacationRequests.endDate })
      .from(vacationRequests)
      .where(
        and(
          eq(vacationRequests.staffId, staff.id),
          eq(vacationRequests.status, "approved"),
          lt(vacationRequests.endDate, request.startDate),
        ),
      )
      .orderBy(desc(vacationRequests.endDate))
      .limit(1);

    const [settings] = await tx
      .select({
        nameArabic: organizationSettings.nameArabic,
        logoImage: organizationSettings.logoImage,
      })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, org.id))
      .limit(1);

    return {
      ...toView(request, staff),
      company: {
        name: org.name,
        nameArabic: settings?.nameArabic ?? "",
        logoImage: settings?.logoImage ?? null,
      },
      employee: {
        designation: staff.jobTitle,
        department: departments
          .map((item) => departmentLabel(item.key))
          .join(", "),
        localContact: staff.phone,
        homeCountryContact: staff.homeCountryContact,
        passportNumber: staff.passportNumber,
        joinedOn: staff.joinedOn ?? "",
        workingDuration: staff.joinedOn
          ? durationInYearsAndMonths(staff.joinedOn, request.startDate)
          : "",
        previousReturn: previous ? addDays(previous.endDate, 1) : "",
      },
      jobHandledBy: request.jobHandledBy,
      leaveAvailableDays: request.leaveAvailableDays,
      officeComments: request.officeComments,
      signoffs,
    };
  });
}

/** Approve or reject as the next signer, confirming with the approval PIN. */
export async function signVacationRequestForUser(
  userId: string,
  orgCode: string,
  requestId: string,
  input: { pin: string; decision: SignoffDecision; remarks: string },
): Promise<VacationStatus> {
  await verifyApprovalPin(userId, input.pin);

  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    const found = await findRequest(tx, org, requestId);
    if (!found) throw new UserError("Leave request not found.");
    const { request } = found;

    const state = await signNextStep(
      tx,
      org,
      userId,
      DOCUMENT_TYPE,
      request.id,
      input,
    );

    if (state.status !== "pending") {
      await tx
        .update(vacationRequests)
        .set({ status: state.status, updatedAt: new Date() })
        .where(eq(vacationRequests.id, request.id));
      await insertStaffActivityLog(tx, {
        organizationId: org.id,
        staffId: request.staffId,
        category: "vacation",
        action: state.status,
        summary:
          state.status === "approved"
            ? "Vacation approved"
            : "Vacation rejected",
        details: describeLeave(request),
        status: state.status,
        dayCount: request.dayCount,
        referenceType: "vacation_request",
        referenceId: request.id,
        actorUserId: userId,
      });
    }

    return state.status;
  });
}
