import { isIsoDate } from "@/lib/datetime/calendar";
import {
  isAssignableDepartmentKey,
  type StaffRoleKey,
} from "@/lib/departments/catalog";
import type {
  StaffContractInput,
  StaffLoginInput,
  StaffProfileInput,
  StaffSalaryInput,
  StaffStatus,
} from "@/lib/staff/types";
import { UserError } from "@/lib/errors";

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
    throw new UserError("Select at least one department.");
  }

  return departmentKeys;
}

export function normalizeStaffProfileInput(
  input: StaffProfileInput,
): StaffProfileInput {
  const fullName = clean(input.fullName);
  if (!fullName) {
    throw new UserError("Full name is required.");
  }
  if (fullName.length > 120) {
    throw new UserError("Full name must be 120 characters or fewer.");
  }

  const email = clean(input.email).toLowerCase();
  if (email && !EMAIL_PATTERN.test(email)) {
    throw new UserError("Email must be a valid email address.");
  }

  const joinedOn = clean(input.joinedOn);
  if (joinedOn && !isIsoDate(joinedOn)) {
    throw new UserError("Joining date is not a valid date.");
  }

  const status = input.status;
  if (!STATUSES.has(status)) {
    throw new UserError("Invalid staff status.");
  }

  return {
    fullName,
    email,
    phone: clean(input.phone),
    homeCountryContact: clean(input.homeCountryContact),
    passportNumber: clean(input.passportNumber).toUpperCase(),
    jobTitle: clean(input.jobTitle),
    employeeCode: clean(input.employeeCode),
    joinedOn,
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
    throw new UserError("Salary must be a valid non-negative number.");
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

export const MIN_PASSWORD_LENGTH = 8;
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function assertValidPassword(password: string): string {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new UserError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }
  return password;
}

export function normalizeStaffLoginInput(
  input: StaffLoginInput,
): StaffLoginInput {
  const username = clean(input.username).toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    throw new UserError(
      "Username must be 3-32 characters: letters, numbers, dots, dashes or underscores.",
    );
  }
  return { username, password: assertValidPassword(input.password) };
}
