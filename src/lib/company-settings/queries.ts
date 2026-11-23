import "server-only";

import { eq } from "drizzle-orm";
import { withTenantContext } from "@/db/client";
import { organizationSettings, organizations } from "@/db/schema";
import { assertCan, can } from "@/lib/access/access";
import {
  MAX_LOGO_LENGTH,
  type CompanyLetterhead,
  type CompanySettingsInput,
  type CompanySettingsView,
} from "@/lib/company-settings/types";
import { normalizeCompanySettingsInput } from "@/lib/company-settings/validate";
import { UserError } from "@/lib/errors";
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
      nameArabic: settings?.nameArabic ?? "",
      logoImage: settings?.logoImage ?? null,
      attendanceSheetNotes: settings?.attendanceSheetNotes ?? "",
      address: settings?.address ?? "",
      addressArabic: settings?.addressArabic ?? "",
      poBox: settings?.poBox ?? "",
      trn: settings?.trn ?? "",
    };
  });
}

/**
 * The company's own details as printed on customer documents. Anyone in the
 * company may read them: they are on every paper that leaves the office.
 */
export async function getCompanyLetterheadForUser(
  userId: string,
  orgCode: string,
): Promise<CompanyLetterhead | null> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org) return null;

    const [settings] = await tx
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, org.id))
      .limit(1);

    return {
      name: org.name,
      nameArabic: settings?.nameArabic ?? "",
      logoImage: settings?.logoImage ?? null,
      telephone: settings?.telephoneNumber ?? "",
      email: settings?.email ?? "",
      address: settings?.address ?? "",
      addressArabic: settings?.addressArabic ?? "",
      poBox: settings?.poBox ?? "",
      trn: settings?.trn ?? "",
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

    const [saved] = await tx
      .insert(organizationSettings)
      .values({ organizationId: org.id, ...settings })
      .onConflictDoUpdate({
        target: organizationSettings.organizationId,
        set: { ...settings, updatedAt: now },
      })
      .returning({ logoImage: organizationSettings.logoImage });

    return {
      organizationId: org.id,
      organizationCode: org.code,
      companyName,
      logoImage: saved?.logoImage ?? null,
      ...settings,
    };
  });
}

/** Set or remove the logo printed on the company's forms. */
export async function saveCompanyLogoForUser(
  userId: string,
  orgCode: string,
  logoImage: string | null,
): Promise<void> {
  if (logoImage !== null) {
    if (!/^data:image\/(png|jpeg);base64,/.test(logoImage)) {
      throw new UserError("The logo must be a PNG or JPG image.");
    }
    if (logoImage.length > MAX_LOGO_LENGTH) {
      throw new UserError("The logo image is too large. Use one under 300 KB.");
    }
  }

  await withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    assertCan(can.manageCompany(org.access));
    await tx
      .insert(organizationSettings)
      .values({ organizationId: org.id, logoImage })
      .onConflictDoUpdate({
        target: organizationSettings.organizationId,
        set: { logoImage, updatedAt: new Date() },
      });
  });
}
