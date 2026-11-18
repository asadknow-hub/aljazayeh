"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { normalizeOrgCode } from "@/lib/org/code";
import {
  createStaffForUser,
  deleteStaffForUser,
  listStaffForUser,
  updateStaffContractForUser,
  updateStaffProfileForUser,
  updateStaffSalaryForUser,
} from "@/lib/staff/queries";
import type {
  StaffContractInput,
  StaffInput,
  StaffProfileInput,
  StaffSalaryInput,
} from "@/lib/staff/types";

function revalidateStaff(orgCode: string, staffId?: string) {
  const code = normalizeOrgCode(orgCode);
  revalidatePath(`/${code}`);
  revalidatePath(`/${code}/staff`);
  revalidatePath(`/${code}/all-logs`);
  if (staffId) {
    revalidatePath(`/${code}/staff/${staffId}`);
  }
}

export async function listStaffAction(orgCode: string) {
  const session = await requireSession();
  return listStaffForUser(session.userId, orgCode);
}

export async function createStaffAction(orgCode: string, input: StaffInput) {
  const session = await requireSession();
  const created = await createStaffForUser(session.userId, orgCode, input);
  revalidateStaff(orgCode, created.id);
  return created;
}

export async function updateStaffAction(
  orgCode: string,
  staffId: string,
  input: StaffInput,
) {
  const session = await requireSession();
  const updated = await updateStaffProfileForUser(
    session.userId,
    orgCode,
    staffId,
    input,
  );
  revalidateStaff(orgCode, staffId);
  return updated;
}

export async function updateStaffProfileAction(
  orgCode: string,
  staffId: string,
  input: StaffProfileInput,
) {
  const session = await requireSession();
  const updated = await updateStaffProfileForUser(
    session.userId,
    orgCode,
    staffId,
    input,
  );
  revalidateStaff(orgCode, staffId);
  return updated;
}

export async function updateStaffSalaryAction(
  orgCode: string,
  staffId: string,
  input: StaffSalaryInput,
) {
  const session = await requireSession();
  const updated = await updateStaffSalaryForUser(
    session.userId,
    orgCode,
    staffId,
    input,
  );
  revalidateStaff(orgCode, staffId);
  return updated;
}

export async function updateStaffContractAction(
  orgCode: string,
  staffId: string,
  input: StaffContractInput,
) {
  const session = await requireSession();
  const updated = await updateStaffContractForUser(
    session.userId,
    orgCode,
    staffId,
    input,
  );
  revalidateStaff(orgCode, staffId);
  return updated;
}

export async function deleteStaffAction(orgCode: string, staffId: string) {
  const session = await requireSession();
  await deleteStaffForUser(session.userId, orgCode, staffId);
  revalidateStaff(orgCode);
  return { ok: true as const };
}
