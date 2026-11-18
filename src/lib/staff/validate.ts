import {
  isAssignableDepartmentKey,
  type StaffRoleKey,
} from "@/lib/departments/catalog";
import type {
  StaffContractInput,
  StaffInput,
  StaffProfileInput,
  StaffSalaryInput,
  StaffStatus,
} from "@/lib/staff/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES = new Set<StaffStatus>(["active", "inactive"]);

function clean(value: string): string {
  return value.trim();
}

function normalizeDepartments(keys: string[]): StaffRoleKey[] {
  const departmentKeys = Array.from(
    new Set(
      (keys ?? []).filter((key): key is StaffRoleKey =>
        isAssignableDepartmentKey(key),
      ),
    ),
  );

  if (departmentKeys.length === 0) {
    throw new Error("Select at least one department.");
  }

  return departmentKeys;
}

export function normalizeStaffInput(input: StaffInput): StaffInput {
  return normalizeStaffProfileInput(input);
}

export function normalizeStaffProfileInput(
  input: StaffProfileInput,
): StaffProfileInput {
  const fullName = clean(input.fullName);
  if (!fullName) {
    throw new Error("Full name is required.");
  }
  if (fullName.length > 120) {
    throw new Error("Full name must be 120 characters or fewer.");
  }

  const email = clean(input.email).toLowerCase();
  if (email && !EMAIL_PATTERN.test(email)) {
    throw new Error("Email must be a valid email address.");
  }

  const status = input.status;
  if (!STATUSES.has(status)) {
    throw new Error("Invalid staff status.");
  }

  return {
    fullName,
    email,
    phone: clean(input.phone),
    jobTitle: clean(input.jobTitle),
    employeeCode: clean(input.employeeCode),
    status,
    notes: clean(input.notes),
    departmentKeys: normalizeDepartments(input.departmentKeys),
  };
}

export function normalizeStaffSalaryInput(
  input: StaffSalaryInput,
): StaffSalaryInput {
  const salaryAmount = clean(input.salaryAmount) || "0";
  if (Number.isNaN(Number(salaryAmount)) || Number(salaryAmount) < 0) {
    throw new Error("Salary must be a valid non-negative number.");
  }

  return {
    salaryAmount,
    salaryCurrency: clean(input.salaryCurrency).toUpperCase() || "AED",
    payFrequency: clean(input.payFrequency) || "monthly",
    lastSalaryPaidOn: clean(input.lastSalaryPaidOn),
    salaryNotes: clean(input.salaryNotes),
  };
}

export function normalizeStaffContractInput(
  input: StaffContractInput,
): StaffContractInput {
  return {
    contractTitle: clean(input.contractTitle),
    contractStatus: clean(input.contractStatus) || "active",
    contractStartDate: clean(input.contractStartDate),
    contractEndDate: clean(input.contractEndDate),
    contractNotes: clean(input.contractNotes),
  };
}
