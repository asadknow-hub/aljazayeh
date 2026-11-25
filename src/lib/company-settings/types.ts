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
  /** Printed on quotations, invoices and the other customer documents. */
  address: string;
  addressArabic: string;
  poBox: string;
  trn: string;
};

/**
 * Another name the company prints its papers under, with its own logo.
 * Everything else on the paper (address, telephone, TRN) is the company's.
 */
export type OtherLetterhead = {
  id: string;
  name: string;
  nameArabic: string;
  logoImage: string | null;
  /** Still offered on new papers. */
  active: boolean;
};

export type OtherLetterheadInput = {
  name: string;
  nameArabic: string;
  logoImage: string | null;
};

/** What a customer document prints about the company itself. */
export type CompanyLetterhead = {
  name: string;
  nameArabic: string;
  logoImage: string | null;
  /** The other names a paper can be printed under instead. */
  others: OtherLetterhead[];
  telephone: string;
  email: string;
  address: string;
  addressArabic: string;
  poBox: string;
  trn: string;
};

export type CompanySettingsView = CompanySettingsInput & {
  organizationId: string;
  organizationCode: string;
  /** Letterhead logo as an image data URL, or null. */
  logoImage: string | null;
};

/** Largest logo accepted, as a data URL. */
export const MAX_LOGO_LENGTH = 400_000;
