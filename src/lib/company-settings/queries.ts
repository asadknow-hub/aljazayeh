import "server-only";

import { asc, desc, eq } from "drizzle-orm";
import { withTenantContext, type DbTransaction } from "@/db/client";
import {
  letterheads,
  organizationSettings,
  organizations,
} from "@/db/schema";
import { assertCan, can } from "@/lib/access/access";
import {
  MAX_LOGO_LENGTH,
  type CompanyLetterhead,
  type CompanySettingsInput,
  type CompanySettingsView,
  type OtherLetterhead,
  type OtherLetterheadInput,
} from "@/lib/company-settings/types";
import { normalizeCompanySettingsInput } from "@/lib/company-settings/validate";
import { UserError } from "@/lib/errors";
import { requireOrg, resolveOrg } from "@/lib/org/resolve";

/** A logo must be a PNG or JPG image of a sensible size. */
function assertLogo(logoImage: string | null) {
  if (logoImage === null) return;
  if (!/^data:image\/(png|jpeg);base64,/.test(logoImage)) {
    throw new UserError("The logo must be a PNG or JPG image.");
  }
  if (logoImage.length > MAX_LOGO_LENGTH) {
    throw new UserError("The logo image is too large. Use one under 300 KB.");
  }
}

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
      others: await loadLetterheads(tx, org.id),
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
  assertLogo(logoImage);

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

/* --------------------- other names to print papers under ------------------- */

/** Every other name the company has had, the ones in use first. */
export async function loadLetterheads(
  tx: DbTransaction,
  organizationId: string,
): Promise<OtherLetterhead[]> {
  const rows = await tx
    .select()
    .from(letterheads)
    .where(eq(letterheads.organizationId, organizationId))
    .orderBy(desc(letterheads.active), asc(letterheads.createdAt));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    nameArabic: row.nameArabic,
    logoImage: row.logoImage,
    active: row.active,
  }));
}

function normalizeLetterhead(input: OtherLetterheadInput): OtherLetterheadInput {
  const clean = (value: string | undefined) =>
    String(value ?? "").trim().replace(/\s+/g, " ");
  const name = clean(input.name);
  if (!name) throw new UserError("Enter the name to print.");
  if (name.length > 120) throw new UserError("The name is too long.");
  const nameArabic = clean(input.nameArabic);
  if (nameArabic.length > 120) {
    throw new UserError("The Arabic name is too long.");
  }
  const logoImage = input.logoImage || null;
  assertLogo(logoImage);
  return { name, nameArabic, logoImage };
}

/** The other names in use, for the people who set the company up. */
async function namesInUse(
  tx: DbTransaction,
  organizationId: string,
): Promise<OtherLetterhead[]> {
  return (await loadLetterheads(tx, organizationId)).filter(
    (item) => item.active,
  );
}

/**
 * Add another name the company prints under, or change one (`id` given).
 * Papers that carry it print the changed name and logo from then on, just
 * as they do when the company's own name or logo is changed.
 */
export async function saveLetterheadForUser(
  userId: string,
  orgCode: string,
  id: string | null,
  input: OtherLetterheadInput,
): Promise<OtherLetterhead[]> {
  const letterhead = normalizeLetterhead(input);

  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    assertCan(can.manageCompany(org.access));

    const inUse = await namesInUse(tx, org.id);
    const same = (name: string) =>
      name.toLowerCase() === letterhead.name.toLowerCase();
    if (same(org.name) || inUse.some((item) => item.id !== id && same(item.name))) {
      throw new UserError(
        `The company already prints under "${letterhead.name}".`,
      );
    }

    if (id === null) {
      await tx
        .insert(letterheads)
        .values({ organizationId: org.id, ...letterhead });
    } else {
      if (!inUse.some((item) => item.id === id)) {
        throw new UserError("That name is no longer there.");
      }
      await tx
        .update(letterheads)
        .set({ ...letterhead, updatedAt: new Date() })
        .where(eq(letterheads.id, id));
    }
    return namesInUse(tx, org.id);
  });
}

/**
 * Stop offering a name on new papers. Papers that already carry it keep
 * printing it.
 */
export async function removeLetterheadForUser(
  userId: string,
  orgCode: string,
  id: string,
): Promise<OtherLetterhead[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    assertCan(can.manageCompany(org.access));
    if (!(await namesInUse(tx, org.id)).some((item) => item.id === id)) {
      throw new UserError("That name is no longer there.");
    }
    await tx
      .update(letterheads)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(letterheads.id, id));
    return namesInUse(tx, org.id);
  });
}

/** The other names in use, for the Company Settings page. */
export async function listLetterheadsForUser(
  userId: string,
  orgCode: string,
): Promise<OtherLetterhead[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.manageCompany(org.access)) return [];
    return namesInUse(tx, org.id);
  });
}
