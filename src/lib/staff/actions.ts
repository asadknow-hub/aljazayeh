"use server";

import { runAction } from "@/lib/actions/result";
import { revalidateCompanyPages } from "@/lib/actions/revalidate";
import { requireSession } from "@/lib/auth/session";
import {
  createStaffForUser,
  createStaffLoginForUser,
  deleteStaffForUser,
  resetStaffPasswordForUser,
  setStaffAdminForUser,
  updateStaffContractForUser,
  updateStaffProfileForUser,
  updateStaffSalaryForUser,
} from "@/lib/staff/queries";
import type {
  StaffContractInput,
  StaffLoginInput,
  StaffProfileInput,
  StaffSalaryInput,
} from "@/lib/staff/types";

export async function createStaffAction(
  orgCode: string,
  input: StaffProfileInput,
) {
  return runAction(async () => {
    const session = await requireSession();
    const created = await createStaffForUser(session.userId, orgCode, input);
    revalidateCompanyPages();
    return created;
  });
}

export async function updateStaffProfileAction(
  orgCode: string,
  staffId: string,
  input: StaffProfileInput,
) {
  return runAction(async () => {
    const session = await requireSession();
    const updated = await updateStaffProfileForUser(
      session.userId,
      orgCode,
      staffId,
      input,
    );
    revalidateCompanyPages();
    return updated;
  });
}

export async function updateStaffSalaryAction(
  orgCode: string,
  staffId: string,
  input: StaffSalaryInput,
) {
  return runAction(async () => {
    const session = await requireSession();
    const updated = await updateStaffSalaryForUser(
      session.userId,
      orgCode,
      staffId,
      input,
    );
    revalidateCompanyPages();
    return updated;
  });
}

export async function updateStaffContractAction(
  orgCode: string,
  staffId: string,
  input: StaffContractInput,
) {
  return runAction(async () => {
    const session = await requireSession();
    const updated = await updateStaffContractForUser(
      session.userId,
      orgCode,
      staffId,
      input,
    );
    revalidateCompanyPages();
    return updated;
  });
}

export async function createStaffLoginAction(
  orgCode: string,
  staffId: string,
  input: StaffLoginInput,
) {
  return runAction(async () => {
    const session = await requireSession();
    const updated = await createStaffLoginForUser(
      session.userId,
      orgCode,
      staffId,
      input,
    );
    revalidateCompanyPages();
    return updated;
  });
}

export async function resetStaffPasswordAction(
  orgCode: string,
  staffId: string,
  password: string,
) {
  return runAction(async () => {
    const session = await requireSession();
    await resetStaffPasswordForUser(session.userId, orgCode, staffId, password);
    revalidateCompanyPages();
  });
}

export async function setStaffAdminAction(
  orgCode: string,
  staffId: string,
  isAdmin: boolean,
) {
  return runAction(async () => {
    const session = await requireSession();
    const updated = await setStaffAdminForUser(
      session.userId,
      orgCode,
      staffId,
      isAdmin,
    );
    revalidateCompanyPages();
    return updated;
  });
}

export async function deleteStaffAction(orgCode: string, staffId: string) {
  return runAction(async () => {
    const session = await requireSession();
    await deleteStaffForUser(session.userId, orgCode, staffId);
    revalidateCompanyPages();
  });
}
