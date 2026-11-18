export type CompanySettingsInput = {
  companyName: string;
  telephoneNumber: string;
  phoneNumber: string;
  whatsappNumber: string;
  email: string;
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  adminName: string;
  adminEmail: string;
  /** Company name in Arabic, for the letterhead of printed forms. */
  nameArabic: string;
  /** Printed under the monthly attendance sheet, one note per line. */
  attendanceSheetNotes: string;
};

export type CompanySettingsView = CompanySettingsInput & {
  organizationId: string;
  organizationCode: string;
  /** Letterhead logo as an image data URL, or null. */
  logoImage: string | null;
};

/** Largest logo accepted, as a data URL. */
export const MAX_LOGO_LENGTH = 400_000;
