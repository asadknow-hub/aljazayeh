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
  /** Printed under the monthly attendance sheet, one note per line. */
  attendanceSheetNotes: string;
};

export type CompanySettingsView = CompanySettingsInput & {
  organizationId: string;
  organizationCode: string;
};
