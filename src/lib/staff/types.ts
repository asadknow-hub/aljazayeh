import type { StaffRoleKey } from "@/lib/departments/catalog";

export type StaffStatus = "active" | "inactive";

export type StaffProfileInput = {
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  employeeCode: string;
  status: StaffStatus;
  notes: string;
  departmentKeys: StaffRoleKey[];
};

/** Create/update payload used by the Add Staff modal. */
export type StaffInput = StaffProfileInput;

export type StaffSalaryInput = {
  salaryAmount: string;
  salaryCurrency: string;
  payFrequency: string;
  lastSalaryPaidOn: string;
  salaryNotes: string;
};

export type StaffContractInput = {
  contractTitle: string;
  contractStatus: string;
  contractStartDate: string;
  contractEndDate: string;
  contractNotes: string;
};

export type StaffView = StaffProfileInput &
  StaffSalaryInput &
  StaffContractInput & {
    id: string;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
  };

export const STAFF_STATUSES: { value: StaffStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const STAFF_DETAIL_SECTIONS = [
  "profile",
  "salary",
  "contract",
  "vacation",
  "login-activity",
  "actions",
] as const;

export type StaffDetailSection = (typeof STAFF_DETAIL_SECTIONS)[number];

export function isStaffDetailSection(value: string): value is StaffDetailSection {
  return (STAFF_DETAIL_SECTIONS as readonly string[]).includes(value);
}

export function formatStaffSalary(amount: string, currency: string): string {
  const numeric = Number(amount);
  if (!amount || Number.isNaN(numeric)) {
    return "—";
  }
  try {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: currency || "AED",
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)} ${currency || "AED"}`;
  }
}
