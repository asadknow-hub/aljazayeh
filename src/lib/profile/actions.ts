"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { listUserOrganizations } from "@/lib/org/queries";
import {
  updateUserEmail,
  updateUserFullName,
  updateUserPassword,
  upsertUserContract,
  upsertUserSalary,
} from "@/lib/profile/queries";
import type { ContractView, SalaryView } from "@/lib/profile/types";

async function revalidateProfile(userId: string) {
  revalidatePath("/settings");
  revalidatePath("/");
  const orgs = await listUserOrganizations(userId);
  for (const org of orgs) {
    revalidatePath(`/${org.code}/company-settings`);
  }
}

export async function saveProfileNameAction(fullName: string) {
  const session = await requireSession();
  const saved = await updateUserFullName(session.userId, fullName);
  await revalidateProfile(session.userId);
  return { fullName: saved };
}

export async function saveProfileEmailAction(email: string) {
  const session = await requireSession();
  const saved = await updateUserEmail(session.userId, email);
  await revalidateProfile(session.userId);
  return { email: saved };
}

export async function changeProfilePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const session = await requireSession();
  await updateUserPassword(session.userId, input);
  await revalidateProfile(session.userId);
  return { ok: true as const };
}

export async function saveProfileSalaryAction(input: SalaryView) {
  const session = await requireSession();
  const saved = await upsertUserSalary(session.userId, input);
  await revalidateProfile(session.userId);
  return saved;
}

export async function saveProfileContractAction(input: ContractView) {
  const session = await requireSession();
  const saved = await upsertUserContract(session.userId, input);
  await revalidateProfile(session.userId);
  return saved;
}
