export const PROFILE_SECTIONS = [
  "account",
  "signature",
  "login-activity",
  "salary",
  "contract",
  "actions",
] as const;

export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export type ProfileSectionMeta = {
  id: ProfileSection;
  label: string;
};

export const PROFILE_SECTION_META: ProfileSectionMeta[] = [
  { id: "account", label: "Account" },
  { id: "signature", label: "Signature" },
  { id: "login-activity", label: "Login activity" },
  { id: "salary", label: "Salary" },
  { id: "contract", label: "Contract" },
  { id: "actions", label: "Actions" },
];

export type ProfileIdentity = {
  userId: string;
  username: string;
  fullName: string;
  email: string;
};

export type LoginActivityItem = {
  id: string;
  occurredAt: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
};

export type SalaryView = {
  amount: string;
  currency: string;
  payFrequency: string;
  effectiveFrom: string;
  notes: string;
};

export type ContractView = {
  id: string | null;
  title: string;
  status: string;
  startDate: string;
  endDate: string;
  notes: string;
};

export type ProfileSettingsBundle = {
  identity: ProfileIdentity;
  loginActivity: LoginActivityItem[];
  salary: SalaryView;
  contract: ContractView;
};

export function isProfileSection(value: string): value is ProfileSection {
  return (PROFILE_SECTIONS as readonly string[]).includes(value);
}

/** Map old section query values to the current Account tab. */
export function resolveProfileSection(value?: string): ProfileSection {
  if (!value) return "account";
  if (
    value === "name" ||
    value === "email" ||
    value === "password" ||
    value === "account"
  ) {
    return "account";
  }
  if (isProfileSection(value)) return value;
  return "account";
}
