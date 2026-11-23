import type { CompanySettingsInput } from "@/lib/company-settings/types";
import { UserError } from "@/lib/errors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: string): string {
  return value.trim();
}

function assertEmail(label: string, value: string) {
  if (!value) return;
  if (!EMAIL_PATTERN.test(value)) {
    throw new UserError(`${label} must be a valid email address.`);
  }
}

function assertUrl(label: string, value: string) {
  if (!value) return;
  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    if (!parsed.hostname.includes(".")) {
      throw new UserError("invalid");
    }
  } catch {
    throw new UserError(`${label} must be a valid URL.`);
  }
}

export function normalizeCompanySettingsInput(
  input: CompanySettingsInput,
): CompanySettingsInput {
  const companyName = clean(input.companyName);
  if (!companyName) {
    throw new UserError("Company name is required.");
  }

  const email = clean(input.email);
  const adminEmail = clean(input.adminEmail).toLowerCase();
  const websiteUrl = clean(input.websiteUrl);
  const instagramUrl = clean(input.instagramUrl);
  const facebookUrl = clean(input.facebookUrl);

  assertEmail("Email", email);
  assertEmail("Admin email", adminEmail);
  assertUrl("Website link", websiteUrl);
  assertUrl("Instagram page", instagramUrl);
  assertUrl("Facebook page", facebookUrl);

  return {
    companyName,
    telephoneNumber: clean(input.telephoneNumber),
    phoneNumber: clean(input.phoneNumber),
    whatsappNumber: clean(input.whatsappNumber),
    email,
    websiteUrl,
    instagramUrl,
    facebookUrl,
    adminName: clean(input.adminName),
    adminEmail,
    nameArabic: clean(input.nameArabic),
    attendanceSheetNotes: input.attendanceSheetNotes
      .split("\n")
      .map(clean)
      .filter(Boolean)
      .join("\n"),
    address: clean(input.address ?? ""),
    addressArabic: clean(input.addressArabic ?? ""),
    poBox: clean(input.poBox ?? ""),
    trn: clean(input.trn ?? ""),
  };
}
