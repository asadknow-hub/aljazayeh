"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { requireSession } from "@/lib/auth/session";
import {
  saveCompanyLogoForUser,
  saveCompanySettingsForUser,
} from "@/lib/company-settings/queries";
import type { CompanySettingsInput } from "@/lib/company-settings/types";

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
