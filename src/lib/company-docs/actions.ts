"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { requireSession } from "@/lib/auth/session";
import {
  restoreCompanyDocVersionForUser,
  saveCompanyDocForUser,
} from "@/lib/company-docs/queries";
import type { DocumentSettingsInput } from "@/lib/company-docs/validate";

export async function saveCompanyDocAction(
  orgCode: string,
  stage: string,
  document: string,
  input: DocumentSettingsInput,
) {
  return runAction(async () => {
    const session = await requireSession();
    const saved = await saveCompanyDocForUser(
      session.userId,
      orgCode,
      stage,
      document,
      input,
    );
    // Every open inquiry shows its papers the new way.
    revalidatePath("/", "layout");
    return saved;
  });
}

export async function restoreCompanyDocVersionAction(
  orgCode: string,
  stage: string,
  document: string,
  version: number,
) {
  return runAction(async () => {
    const session = await requireSession();
    const saved = await restoreCompanyDocVersionForUser(
      session.userId,
      orgCode,
      stage,
      document,
      version,
    );
    revalidatePath("/", "layout");
    return saved;
  });
}
