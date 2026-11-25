"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { requireSession } from "@/lib/auth/session";
import {
  removeLetterheadForUser,
  saveCompanyLogoForUser,
  saveCompanySettingsForUser,
  saveLetterheadForUser,
} from "@/lib/company-settings/queries";
import type {
  CompanySettingsInput,
  OtherLetterheadInput,
} from "@/lib/company-settings/types";

export async function saveCompanySettingsAction(
  orgCode: string,
  input: CompanySettingsInput,
) {
  return runAction(async () => {
    const session = await requireSession();
    const saved = await saveCompanySettingsForUser(
      session.userId,
      orgCode,
      input,
    );
    // The company name appears in the header on every page.
    revalidatePath("/", "layout");
    return saved;
  });
}

export async function saveCompanyLogoAction(
  orgCode: string,
  logoImage: string | null,
) {
  return runAction(async () => {
    const session = await requireSession();
    await saveCompanyLogoForUser(session.userId, orgCode, logoImage);
    revalidatePath("/", "layout");
  });
}

/** Add another name the company prints under, or change one. */
export async function saveLetterheadAction(
  orgCode: string,
  id: string | null,
  input: OtherLetterheadInput,
) {
  return runAction(async () => {
    const session = await requireSession();
    const names = await saveLetterheadForUser(
      session.userId,
      orgCode,
      id,
      input,
    );
    revalidatePath("/", "layout");
    return names;
  });
}

export async function removeLetterheadAction(orgCode: string, id: string) {
  return runAction(async () => {
    const session = await requireSession();
    const names = await removeLetterheadForUser(session.userId, orgCode, id);
    revalidatePath("/", "layout");
    return names;
  });
}
