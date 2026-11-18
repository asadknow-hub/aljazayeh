import "server-only";

import { eq } from "drizzle-orm";
import { withTenantContext } from "@/db/client";
import { organizationSettings, organizations } from "@/db/schema";
import { assertCan, can } from "@/lib/access/access";
import type {
  CompanySettingsInput,
  CompanySettingsView,
} from "@/lib/company-settings/types";
import { normalizeCompanySettingsInput } from "@/lib/company-settings/validate";
import { requireOrg, resolveOrg } from "@/lib/org/resolve";

export async function getCompanySettingsForUser(
  userId: string,
  orgCode: string,
): Promise<CompanySettingsView | null> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.manageCompany(org.access)) return null;

    const [settings] = await tx
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, org.id))
      .limit(1);

    return {
      organizationId: org.id,
      organizationCode: org.code,
      companyName: org.name,
      telephoneNumber: settings?.telephoneNumber ?? "",
      phoneNumber: settings?.phoneNumber ?? "",
      whatsappNumber: settings?.whatsappNumber ?? "",
      email: settings?.email ?? "",
      websiteUrl: settings?.websiteUrl ?? "",
      instagramUrl: settings?.instagramUrl ?? "",
      facebookUrl: settings?.facebookUrl ?? "",
      adminName: settings?.adminName ?? "",
      adminEmail: settings?.adminEmail ?? "",
    };
  });
}

export async function saveCompanySettingsForUser(
  userId: string,
  orgCode: string,
  input: CompanySettingsInput,
): Promise<CompanySettingsView> {
  const { companyName, ...settings } = normalizeCompanySettingsInput(input);

  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    assertCan(can.manageCompany(org.access));

    const now = new Date();
    await tx
      .update(organizations)
      .set({ name: companyName, updatedAt: now })
      .where(eq(organizations.id, org.id));

    await tx
      .insert(organizationSettings)
      .values({ organizationId: org.id, ...settings })
      .onConflictDoUpdate({
        target: organizationSettings.organizationId,
        set: { ...settings, updatedAt: now },
      });

    return {
      organizationId: org.id,
      organizationCode: org.code,
      companyName,
      ...settings,
    };
  });
}
