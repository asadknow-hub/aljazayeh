import "server-only";

import { eq } from "drizzle-orm";
import { withTenantContext } from "@/db/client";
import {
  organizationSettings,
  organizations,
  users,
} from "@/db/schema";
import {
  syncAdminContactToUserOrgs,
  userIsOrgAdmin,
} from "@/lib/company-settings/admin-contact";
import type {
  CompanySettingsInput,
  CompanySettingsView,
} from "@/lib/company-settings/types";
import { normalizeCompanySettingsInput } from "@/lib/company-settings/validate";
import { resolveOrg } from "@/lib/org/resolve";

const emptySettings = {
  telephoneNumber: "",
  phoneNumber: "",
  whatsappNumber: "",
  email: "",
  websiteUrl: "",
  instagramUrl: "",
  facebookUrl: "",
  adminName: "",
  adminEmail: "",
} as const;

export async function getCompanySettingsForUser(
  userId: string,
  orgCode: string,
): Promise<CompanySettingsView | null> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);

    if (!org) return null;

    const [settings] = await tx
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, org.id))
      .limit(1);

    let adminName = settings?.adminName ?? emptySettings.adminName;
    let adminEmail = settings?.adminEmail ?? emptySettings.adminEmail;

    // Display fallback only — never write on GET.
    if ((!adminName || !adminEmail) && (await userIsOrgAdmin(tx, userId, org.id))) {
      const [profile] = await tx
        .select({
          fullName: users.fullName,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (profile) {
        if (!adminName) adminName = profile.fullName.trim();
        if (!adminEmail) adminEmail = profile.email.trim();
      }
    }

    return {
      organizationId: org.id,
      organizationCode: org.code,
      companyName: org.name,
      telephoneNumber: settings?.telephoneNumber ?? emptySettings.telephoneNumber,
      phoneNumber: settings?.phoneNumber ?? emptySettings.phoneNumber,
      whatsappNumber: settings?.whatsappNumber ?? emptySettings.whatsappNumber,
      email: settings?.email ?? emptySettings.email,
      websiteUrl: settings?.websiteUrl ?? emptySettings.websiteUrl,
      instagramUrl: settings?.instagramUrl ?? emptySettings.instagramUrl,
      facebookUrl: settings?.facebookUrl ?? emptySettings.facebookUrl,
      adminName,
      adminEmail,
    };
  });
}

export async function saveCompanySettingsForUser(
  userId: string,
  orgCode: string,
  input: CompanySettingsInput,
): Promise<CompanySettingsView> {
  const normalized = normalizeCompanySettingsInput(input);

  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);

    if (!org) {
      throw new Error("Company not found.");
    }

    await tx
      .update(organizations)
      .set({
        name: normalized.companyName,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, org.id));

    const [existing] = await tx
      .select({ organizationId: organizationSettings.organizationId })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, org.id))
      .limit(1);

    const settingsValues = {
      telephoneNumber: normalized.telephoneNumber,
      phoneNumber: normalized.phoneNumber,
      whatsappNumber: normalized.whatsappNumber,
      email: normalized.email,
      websiteUrl: normalized.websiteUrl,
      instagramUrl: normalized.instagramUrl,
      facebookUrl: normalized.facebookUrl,
      adminName: normalized.adminName,
      adminEmail: normalized.adminEmail,
      updatedAt: new Date(),
    };

    if (existing) {
      await tx
        .update(organizationSettings)
        .set(settingsValues)
        .where(eq(organizationSettings.organizationId, org.id));
    } else {
      await tx.insert(organizationSettings).values({
        organizationId: org.id,
        ...settingsValues,
      });
    }

    const isAdmin = await userIsOrgAdmin(tx, userId, org.id);
    if (isAdmin) {
      if (!normalized.adminName) {
        throw new Error("Admin name is required.");
      }
      if (!normalized.adminEmail) {
        throw new Error("Admin email is required.");
      }

      await tx
        .update(users)
        .set({
          fullName: normalized.adminName,
          email: normalized.adminEmail,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      await syncAdminContactToUserOrgs(tx, userId, {
        adminName: normalized.adminName,
        adminEmail: normalized.adminEmail,
      });
    }

    return {
      organizationId: org.id,
      organizationCode: org.code,
      ...normalized,
    };
  });
}
