"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { saveCompanySettingsForUser } from "@/lib/company-settings/queries";
import type { CompanySettingsInput } from "@/lib/company-settings/types";

export async function saveCompanySettingsAction(
  orgCode: string,
  input: CompanySettingsInput,
) {
  const session = await requireSession();
  const saved = await saveCompanySettingsForUser(
    session.userId,
    orgCode,
    input,
  );

  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath(`/${saved.organizationCode}`);
  revalidatePath(`/${saved.organizationCode}/company-settings`);

  return saved;
}
