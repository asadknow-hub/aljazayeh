"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { requireSession } from "@/lib/auth/session";
import {
  updateUserEmail,
  updateUserFullName,
  updateUserPassword,
  upsertUserContract,
  upsertUserSalary,
} from "@/lib/profile/queries";
import type { ContractView, SalaryView } from "@/lib/profile/types";

/** The user's name shows in the header on every page. */
function revalidateEverything() {
  revalidatePath("/", "layout");
}

export async function saveProfileNameAction(fullName: string) {
  return runAction(async () => {
    const session = await requireSession();
    const saved = await updateUserFullName(session.userId, fullName);
    revalidateEverything();
    return { fullName: saved };
  });
}

export async function saveProfileEmailAction(email: string) {
  return runAction(async () => {
    const session = await requireSession();
    const saved = await updateUserEmail(session.userId, email);
    revalidateEverything();
    return { email: saved };
  });
}

export async function changeProfilePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return runAction(async () => {
    const session = await requireSession();
    await updateUserPassword(session.userId, input);
  });
}

export async function saveProfileSalaryAction(input: SalaryView) {
  return runAction(async () => {
    const session = await requireSession();
    return upsertUserSalary(session.userId, input);
  });
}

export async function saveProfileContractAction(input: ContractView) {
  return runAction(async () => {
    const session = await requireSession();
    return upsertUserContract(session.userId, input);
  });
}
