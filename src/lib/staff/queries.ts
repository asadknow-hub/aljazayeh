import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { withTenantContext, type DbTransaction } from "@/db/client";
import {
  approvalForms,
  attendanceRecords,
  inquiries,
  staffDepartmentAssignments,
  staffMembers,
  vacationRequests,
} from "@/db/schema";
import { assertCan, can } from "@/lib/access/access";
import { insertStaffActivityLog } from "@/lib/activity/record";
import { hashPassword } from "@/lib/auth/password";
import {
  departmentLabel,
  isAssignableDepartmentKey,
  type StaffRoleKey,
} from "@/lib/departments/catalog";
import { UserError } from "@/lib/errors";
import { requireOrg, resolveOrg, type ResolvedOrg } from "@/lib/org/resolve";
import type {
  StaffContractInput,
  StaffLoginInput,
  StaffOption,
  StaffProfileInput,
  StaffSalaryInput,
  StaffStatus,
  StaffView,
} from "@/lib/staff/types";
import {
  assertValidPassword,
  normalizeStaffContractInput,
  normalizeStaffLoginInput,
  normalizeStaffProfileInput,
  normalizeStaffSalaryInput,
} from "@/lib/staff/validate";
import { isUuid } from "@/lib/ids";

type StaffRow = typeof staffMembers.$inferSelect;

function toView(
  row: StaffRow,
  departmentKeys: StaffRoleKey[],
  loginUsername: string | null,
): StaffView {
  return {
    id: row.id,
    organizationId: row.organizationId,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    homeCountryContact: row.homeCountryContact,
    passportNumber: row.passportNumber,
    jobTitle: row.jobTitle,
    employeeCode: row.employeeCode,
    joinedOn: row.joinedOn ?? "",
    status: row.status as StaffStatus,
    isAdmin: row.isAdmin,
    loginUsername,
    notes: row.notes,
    departmentKeys,
    salaryAmount: String(row.salaryAmount),
    salaryCurrency: row.salaryCurrency,
    payFrequency: row.payFrequency,
    lastSalaryPaidOn: row.lastSalaryPaidOn,
    salaryNotes: row.salaryNotes,
    contractTitle: row.contractTitle,
    contractStatus: row.contractStatus,
    contractStartDate: row.contractStartDate,
    contractEndDate: row.contractEndDate,
    contractNotes: row.contractNotes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Staff rows of a company with their departments and login usernames. */
async function loadStaffViews(
  tx: DbTransaction,
  organizationId: string,
  staffId?: string,
): Promise<StaffView[]> {
  if (staffId !== undefined && !isUuid(staffId)) return [];
  const rows = await tx
    .select({
      staff: staffMembers,
      loginUsername: sql<
        string | null
      >`app_staff_login_username(${staffMembers.id})`,
    })
    .from(staffMembers)
    .where(
      and(
        eq(staffMembers.organizationId, organizationId),
        staffId ? eq(staffMembers.id, staffId) : undefined,
      ),
    )
    .orderBy(asc(staffMembers.fullName));

  if (rows.length === 0) return [];

  const assignments = await tx
    .select()
    .from(staffDepartmentAssignments)
    .where(
      inArray(
        staffDepartmentAssignments.staffId,
        rows.map((row) => row.staff.id),
      ),
    );

  const departments = new Map<string, StaffRoleKey[]>();
  for (const assignment of assignments) {
    if (!isAssignableDepartmentKey(assignment.departmentKey)) continue;
    const list = departments.get(assignment.staffId) ?? [];
    list.push(assignment.departmentKey);
    departments.set(assignment.staffId, list);
  }

  return rows.map((row) =>
    toView(row.staff, departments.get(row.staff.id) ?? [], row.loginUsername),
  );
}

async function requireStaffView(
  tx: DbTransaction,
  org: ResolvedOrg,
  staffId: string,
): Promise<StaffView> {
  const [view] = await loadStaffViews(tx, org.id, staffId);
  if (!view) throw new UserError("Staff member not found.");
  return view;
}

export async function listStaffForUser(
  userId: string,
  orgCode: string,
): Promise<StaffView[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.manageStaff(org.access)) return [];
    return loadStaffViews(tx, org.id);
  });
}

/** Names only, for screens that pick a person (leave requests). */
export async function listStaffOptionsForUser(
  userId: string,
  orgCode: string,
): Promise<StaffOption[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.useReception(org.access)) return [];

    const rows = await tx
      .select({
        id: staffMembers.id,
        fullName: staffMembers.fullName,
        jobTitle: staffMembers.jobTitle,
        status: staffMembers.status,
      })
      .from(staffMembers)
      .where(eq(staffMembers.organizationId, org.id))
      .orderBy(asc(staffMembers.fullName));

    return rows.map((row) => ({ ...row, status: row.status as StaffStatus }));
  });
}

export async function getStaffForUser(
  userId: string,
  orgCode: string,
  staffId: string,
): Promise<StaffView | null> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.manageStaff(org.access)) return null;
    const [view] = await loadStaffViews(tx, org.id, staffId);
    return view ?? null;
  });
}

/**
 * Nobody is put in a department the company does not have (see the
 * organisation chart). One somebody was already in is left as it is.
 */
function assertDepartmentsInUse(
  org: ResolvedOrg,
  departmentKeys: StaffRoleKey[],
  already: readonly string[] = [],
) {
  const closed = departmentKeys.find(
    (key) =>
      org.access.closedDepartments.includes(key) && !already.includes(key),
  );
  if (closed) {
    throw new UserError(
      `This company does not have a ${departmentLabel(closed)} department. It can be added under Organization.`,
    );
  }
}

async function replaceDepartments(
  tx: DbTransaction,
  staffId: string,
  departmentKeys: StaffRoleKey[],
) {
  await tx
    .delete(staffDepartmentAssignments)
    .where(eq(staffDepartmentAssignments.staffId, staffId));
  await tx
    .insert(staffDepartmentAssignments)
    .values(
      departmentKeys.map((departmentKey) => ({ staffId, departmentKey })),
    );
}

export async function createStaffForUser(
  userId: string,
  orgCode: string,
  input: StaffProfileInput,
): Promise<StaffView> {
  const normalized = normalizeStaffProfileInput(input);

  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    assertCan(can.manageStaff(org.access));
    assertDepartmentsInUse(org, normalized.departmentKeys);

    const staffId = crypto.randomUUID();
    await tx.insert(staffMembers).values({
      id: staffId,
      organizationId: org.id,
      fullName: normalized.fullName,
      email: normalized.email,
      phone: normalized.phone,
      homeCountryContact: normalized.homeCountryContact,
      passportNumber: normalized.passportNumber,
      jobTitle: normalized.jobTitle,
      employeeCode: normalized.employeeCode,
      joinedOn: normalized.joinedOn || null,
      status: normalized.status,
      notes: normalized.notes,
    });
    await replaceDepartments(tx, staffId, normalized.departmentKeys);

    await insertStaffActivityLog(tx, {
      organizationId: org.id,
      staffId,
      category: "staff",
      action: "created",
      summary: "Staff record created",
      details: normalized.jobTitle || "Staff member",
      status: normalized.status,
      referenceType: "staff_member",
      referenceId: staffId,
      actorUserId: userId,
    });

    return requireStaffView(tx, org, staffId);
  });
}

export async function updateStaffProfileForUser(
  userId: string,
  orgCode: string,
  staffId: string,
  input: StaffProfileInput,
): Promise<StaffView> {
  const normalized = normalizeStaffProfileInput(input);

  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    assertCan(can.manageStaff(org.access));
    const existing = await requireStaffView(tx, org, staffId);
    assertDepartmentsInUse(
      org,
      normalized.departmentKeys,
      existing.departmentKeys,
    );

    // Only an administrator may change an administrator's record, and nobody
    // can lock themselves out by deactivating their own record.
    if (existing.isAdmin) assertCan(can.manageCompany(org.access));
    if (staffId === org.access.staffId && normalized.status !== "active") {
      throw new UserError("You cannot deactivate your own staff record.");
    }

    await tx
      .update(staffMembers)
      .set({
        fullName: normalized.fullName,
        email: normalized.email,
        phone: normalized.phone,
        homeCountryContact: normalized.homeCountryContact,
        passportNumber: normalized.passportNumber,
        jobTitle: normalized.jobTitle,
        employeeCode: normalized.employeeCode,
        joinedOn: normalized.joinedOn || null,
        status: normalized.status,
        notes: normalized.notes,
        updatedAt: new Date(),
      })
      .where(eq(staffMembers.id, staffId));
    await replaceDepartments(tx, staffId, normalized.departmentKeys);

    if (existing.status !== normalized.status) {
      await insertStaffActivityLog(tx, {
        organizationId: org.id,
        staffId,
        category: "staff",
        action: normalized.status === "active" ? "activated" : "deactivated",
        summary:
          normalized.status === "active"
            ? "Staff record activated"
            : "Staff record deactivated",
        status: normalized.status,
        referenceType: "staff_member",
        referenceId: staffId,
        actorUserId: userId,
      });
    }

    return requireStaffView(tx, org, staffId);
  });
}

async function updateStaffFields(
  userId: string,
  orgCode: string,
  staffId: string,
  fields: Partial<typeof staffMembers.$inferInsert>,
): Promise<StaffView> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    assertCan(can.manageStaff(org.access));
    await requireStaffView(tx, org, staffId);

    await tx
      .update(staffMembers)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(staffMembers.id, staffId));

    return requireStaffView(tx, org, staffId);
  });
}

export async function updateStaffSalaryForUser(
  userId: string,
  orgCode: string,
  staffId: string,
  input: StaffSalaryInput,
): Promise<StaffView> {
  return updateStaffFields(
    userId,
    orgCode,
    staffId,
    normalizeStaffSalaryInput(input),
  );
}

export async function updateStaffContractForUser(
  userId: string,
  orgCode: string,
  staffId: string,
  input: StaffContractInput,
): Promise<StaffView> {
  return updateStaffFields(
    userId,
    orgCode,
    staffId,
    normalizeStaffContractInput(input),
  );
}

/** Database functions signal expected refusals with these codes. */
const LOGIN_ERRORS: Record<string, string> = {
  USERNAME_TAKEN: "That username is already in use. Choose another.",
  STAFF_HAS_LOGIN: "This staff member already has a login.",
  STAFF_HAS_NO_LOGIN: "This staff member has no login yet.",
  OWNER_PASSWORD_PROTECTED:
    "Only the owner can change the owner's password, from their own Account page.",
};

function asLoginError(error: unknown): unknown {
  const text = `${(error as Error)?.message} ${((error as Error)?.cause as Error)?.message}`;
  const code = Object.keys(LOGIN_ERRORS).find((key) => text.includes(key));
  return code ? new UserError(LOGIN_ERRORS[code]!) : error;
}

/** Give a staff member a username and password so they can sign in. */
export async function createStaffLoginForUser(
  userId: string,
  orgCode: string,
  staffId: string,
  input: StaffLoginInput,
): Promise<StaffView> {
  const { username, password } = normalizeStaffLoginInput(input);
  const passwordHash = await hashPassword(password);

  try {
    return await withTenantContext(userId, async (tx) => {
      const org = await requireOrg(tx, userId, orgCode);
      assertCan(can.manageCompany(org.access));
      await requireStaffView(tx, org, staffId);

      await tx.execute(sql`
        select app_create_staff_login(${staffId}::uuid, ${username}, ${passwordHash})
      `);
      await insertStaffActivityLog(tx, {
        organizationId: org.id,
        staffId,
        category: "staff",
        action: "login_created",
        summary: "Login created",
        details: `Username: ${username}`,
        referenceType: "staff_member",
        referenceId: staffId,
        actorUserId: userId,
      });

      return requireStaffView(tx, org, staffId);
    });
  } catch (error) {
    throw asLoginError(error);
  }
}

export async function resetStaffPasswordForUser(
  userId: string,
  orgCode: string,
  staffId: string,
  password: string,
): Promise<void> {
  const passwordHash = await hashPassword(assertValidPassword(password));

  try {
    await withTenantContext(userId, async (tx) => {
      const org = await requireOrg(tx, userId, orgCode);
      assertCan(can.manageCompany(org.access));
      await requireStaffView(tx, org, staffId);

      await tx.execute(sql`
        select app_reset_staff_password(${staffId}::uuid, ${passwordHash})
      `);
      await insertStaffActivityLog(tx, {
        organizationId: org.id,
        staffId,
        category: "staff",
        action: "password_reset",
        summary: "Password reset by an administrator",
        referenceType: "staff_member",
        referenceId: staffId,
        actorUserId: userId,
      });
    });
  } catch (error) {
    throw asLoginError(error);
  }
}

/** Make a staff member a company administrator, or take that away. */
export async function setStaffAdminForUser(
  userId: string,
  orgCode: string,
  staffId: string,
  isAdmin: boolean,
): Promise<StaffView> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    assertCan(can.manageCompany(org.access));
    await requireStaffView(tx, org, staffId);

    // You stay an administrator yourself, so a company always has one.
    if (staffId === org.access.staffId && !isAdmin) {
      throw new UserError(
        "You cannot remove your own administrator access. Ask another administrator.",
      );
    }

    await tx
      .update(staffMembers)
      .set({ isAdmin, updatedAt: new Date() })
      .where(eq(staffMembers.id, staffId));
    await insertStaffActivityLog(tx, {
      organizationId: org.id,
      staffId,
      category: "staff",
      action: isAdmin ? "admin_granted" : "admin_removed",
      summary: isAdmin
        ? "Made a company administrator"
        : "Administrator access removed",
      referenceType: "staff_member",
      referenceId: staffId,
      actorUserId: userId,
    });

    return requireStaffView(tx, org, staffId);
  });
}

/**
 * Remove a staff record created by mistake. Anyone with history (a login,
 * leave requests, attendance, assigned inquiries) is deactivated instead, so records
 * that refer to them stay intact.
 */
export async function deleteStaffForUser(
  userId: string,
  orgCode: string,
  staffId: string,
): Promise<void> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    assertCan(can.manageStaff(org.access));
    const staff = await requireStaffView(tx, org, staffId);

    const [leave] = await tx
      .select({ id: vacationRequests.id })
      .from(vacationRequests)
      .where(eq(vacationRequests.staffId, staffId))
      .limit(1);
    const [assigned] = await tx
      .select({ id: inquiries.id })
      .from(inquiries)
      .where(eq(inquiries.assignedStaffId, staffId))
      .limit(1);
    const [attendance] = await tx
      .select({ id: attendanceRecords.id })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.staffId, staffId))
      .limit(1);

    const [form] = await tx
      .select({ id: approvalForms.id })
      .from(approvalForms)
      .where(eq(approvalForms.staffId, staffId))
      .limit(1);

    if (
      staff.loginUsername ||
      staff.isAdmin ||
      leave ||
      assigned ||
      attendance ||
      form
    ) {
      throw new UserError(
        "This person has a login or history in the system and cannot be deleted. Set their status to Inactive instead.",
      );
    }

    await tx.delete(staffMembers).where(eq(staffMembers.id, staffId));
  });
}
