"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import {
  getCompanySettingsForUser,
  saveCompanySettingsForUser,
} from "@/lib/company-settings/queries";
import type { CompanySettingsInput } from "@/lib/company-settings/types";
import { normalizeOrgCode } from "@/lib/org/code";

export async function getCompanySettingsAction(orgCode: string) {
  const session = await requireSession();
  const settings = await getCompanySettingsForUser(session.userId, orgCode);
  if (!settings) {
    throw new Error("Company not found.");
  }
  return settings;
}

export async function saveCompanySettingsAction(
  orgCode: string,
  input: CompanySettingsInput,
) {
  const session = await requireSession();
  const code = normalizeOrgCode(orgCode);
  const saved = await saveCompanySettingsForUser(session.userId, code, input);

  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath(`/${saved.organizationCode}`);
  revalidatePath(`/${saved.organizationCode}/company-settings`);

  return saved;
}
