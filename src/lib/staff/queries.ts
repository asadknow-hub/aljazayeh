import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { withTenantContext } from "@/db/client";
import {
  staffDepartmentAssignments,
  staffMembers,
} from "@/db/schema";
import { insertStaffActivityLog } from "@/lib/activity/record";
import {
  isAssignableDepartmentKey,
  type StaffRoleKey,
} from "@/lib/departments/catalog";
import { resolveOrg } from "@/lib/org/resolve";
import type {
  StaffContractInput,
  StaffInput,
  StaffProfileInput,
  StaffSalaryInput,
  StaffStatus,
  StaffView,
} from "@/lib/staff/types";
import {
  normalizeStaffContractInput,
  normalizeStaffInput,
  normalizeStaffProfileInput,
  normalizeStaffSalaryInput,
} from "@/lib/staff/validate";

function toView(
  row: typeof staffMembers.$inferSelect,
  departmentKeys: StaffRoleKey[],
): StaffView {
  return {
    id: row.id,
    organizationId: row.organizationId,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    jobTitle: row.jobTitle,
    employeeCode: row.employeeCode,
    status: (row.status === "on_leave" ? "active" : row.status) as StaffStatus,
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

async function loadDepartmentKeys(
  tx: Parameters<Parameters<typeof withTenantContext>[1]>[0],
  staffIds: string[],
) {
  if (staffIds.length === 0) {
    return new Map<string, StaffRoleKey[]>();
  }

  const assignments = await tx
    .select()
    .from(staffDepartmentAssignments)
    .where(inArray(staffDepartmentAssignments.staffId, staffIds));

  const byStaff = new Map<string, StaffRoleKey[]>();
  for (const assignment of assignments) {
    const key =
      assignment.departmentKey === "staff"
        ? "management"
        : assignment.departmentKey;
    if (!isAssignableDepartmentKey(key)) continue;
    const list = byStaff.get(assignment.staffId) ?? [];
    list.push(key);
    byStaff.set(assignment.staffId, list);
  }
  return byStaff;
}

export async function listStaffForUser(
  userId: string,
  orgCode: string,
): Promise<StaffView[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org) return [];

    const rows = await tx
      .select()
      .from(staffMembers)
      .where(eq(staffMembers.organizationId, org.id))
      .orderBy(asc(staffMembers.fullName));

    const byStaff = await loadDepartmentKeys(
      tx,
      rows.map((row) => row.id),
    );

    return rows.map((row) => toView(row, byStaff.get(row.id) ?? []));
  });
}

export async function getStaffForUser(
  userId: string,
  orgCode: string,
  staffId: string,
): Promise<StaffView | null> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org) return null;

    const [row] = await tx
      .select()
      .from(staffMembers)
      .where(
        and(
          eq(staffMembers.id, staffId),
          eq(staffMembers.organizationId, org.id),
        ),
      )
      .limit(1);

    if (!row) return null;

    const byStaff = await loadDepartmentKeys(tx, [row.id]);
    return toView(row, byStaff.get(row.id) ?? []);
  });
}

export async function createStaffForUser(
  userId: string,
  orgCode: string,
  input: StaffInput,
): Promise<StaffView> {
  const normalized = normalizeStaffInput(input);

  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org) {
      throw new Error("Company not found.");
    }

    const staffId = crypto.randomUUID();

    await tx.insert(staffMembers).values({
      id: staffId,
      organizationId: org.id,
      fullName: normalized.fullName,
      email: normalized.email,
      phone: normalized.phone,
      jobTitle: normalized.jobTitle,
      employeeCode: normalized.employeeCode,
      status: normalized.status,
      notes: normalized.notes,
    });

    await tx.insert(staffDepartmentAssignments).values(
      normalized.departmentKeys.map((departmentKey) => ({
        staffId,
        departmentKey,
      })),
    );

    const now = new Date();
    await insertStaffActivityLog(tx, {
      organizationId: org.id,
      staffId,
      occurredAt: now,
      category: "staff",
      action: "created",
      summary: "Staff record created",
      details: normalized.jobTitle || "Staff member",
      status: normalized.status,
      referenceType: "staff_member",
      referenceId: staffId,
      actorUserId: userId,
    });

    const [row] = await tx
      .select()
      .from(staffMembers)
      .where(eq(staffMembers.id, staffId))
      .limit(1);

    if (!row) {
      throw new Error("Failed to create staff member.");
    }

    return toView(row, normalized.departmentKeys);
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
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org) {
      throw new Error("Company not found.");
    }

    const [existing] = await tx
      .select()
      .from(staffMembers)
      .where(
        and(
          eq(staffMembers.id, staffId),
          eq(staffMembers.organizationId, org.id),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new Error("Staff member not found.");
    }

    await tx
      .update(staffMembers)
      .set({
        fullName: normalized.fullName,
        email: normalized.email,
        phone: normalized.phone,
        jobTitle: normalized.jobTitle,
        employeeCode: normalized.employeeCode,
        status: normalized.status,
        notes: normalized.notes,
        updatedAt: new Date(),
      })
      .where(eq(staffMembers.id, staffId));

    await tx
      .delete(staffDepartmentAssignments)
      .where(eq(staffDepartmentAssignments.staffId, staffId));

    await tx.insert(staffDepartmentAssignments).values(
      normalized.departmentKeys.map((departmentKey) => ({
        staffId,
        departmentKey,
      })),
    );

    const [row] = await tx
      .select()
      .from(staffMembers)
      .where(eq(staffMembers.id, staffId))
      .limit(1);

    if (!row) {
      throw new Error("Failed to update staff member.");
    }

    return toView(row, normalized.departmentKeys);
  });
}

export async function updateStaffSalaryForUser(
  userId: string,
  orgCode: string,
  staffId: string,
  input: StaffSalaryInput,
): Promise<StaffView> {
  const normalized = normalizeStaffSalaryInput(input);

  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org) {
      throw new Error("Company not found.");
    }

    const updated = await tx
      .update(staffMembers)
      .set({
        salaryAmount: normalized.salaryAmount,
        salaryCurrency: normalized.salaryCurrency,
        payFrequency: normalized.payFrequency,
        lastSalaryPaidOn: normalized.lastSalaryPaidOn,
        salaryNotes: normalized.salaryNotes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(staffMembers.id, staffId),
          eq(staffMembers.organizationId, org.id),
        ),
      )
      .returning();

    if (updated.length === 0) {
      throw new Error("Staff member not found.");
    }

    const byStaff = await loadDepartmentKeys(tx, [staffId]);
    return toView(updated[0], byStaff.get(staffId) ?? []);
  });
}

export async function updateStaffContractForUser(
  userId: string,
  orgCode: string,
  staffId: string,
  input: StaffContractInput,
): Promise<StaffView> {
  const normalized = normalizeStaffContractInput(input);

  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org) {
      throw new Error("Company not found.");
    }

    const updated = await tx
      .update(staffMembers)
      .set({
        contractTitle: normalized.contractTitle,
        contractStatus: normalized.contractStatus,
        contractStartDate: normalized.contractStartDate,
        contractEndDate: normalized.contractEndDate,
        contractNotes: normalized.contractNotes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(staffMembers.id, staffId),
          eq(staffMembers.organizationId, org.id),
        ),
      )
      .returning();

    if (updated.length === 0) {
      throw new Error("Staff member not found.");
    }

    const byStaff = await loadDepartmentKeys(tx, [staffId]);
    return toView(updated[0], byStaff.get(staffId) ?? []);
  });
}

export async function deleteStaffForUser(
  userId: string,
  orgCode: string,
  staffId: string,
): Promise<void> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org) {
      throw new Error("Company not found.");
    }

    const deleted = await tx
      .delete(staffMembers)
      .where(
        and(
          eq(staffMembers.id, staffId),
          eq(staffMembers.organizationId, org.id),
        ),
      )
      .returning({ id: staffMembers.id });

    if (deleted.length === 0) {
      throw new Error("Staff member not found.");
    }
  });
}
