/**
 * The organisation chart: the owners at the top, Accounts under them, and
 * every other department under Accounts. Each part has positions, and each
 * position is held by one person.
 *
 * The chart is where the paperwork gets its people from. The company's
 * forms are signed by the owners and by the positions that sign in a role
 * (src/lib/signoffs/chains.ts), and an inquiry step is approved by the
 * owners or by one position. Remove a position and nothing asks for it any
 * more; add an owner and every form gets a box for them.
 */
import { STAFF_ASSIGNABLE_ROLES } from "@/lib/departments/catalog";
import { OWNERS_BLOCK, type SigningRole } from "@/lib/signoffs/chains";

/** A company has at least one owner and at most this many. */
export const MAX_OWNERS = 4;

/** Accounts sits directly under the owners; a company always has it. */
export const ACCOUNTS_DEPARTMENT = "accounts";

/**
 * The departments of the chart, Accounts first. Management is not one of
 * them: the people who run the company are its owners, at the top.
 */
export const CHART_DEPARTMENTS = [
  ACCOUNTS_DEPARTMENT,
  "admin",
  "sales",
  "engineering",
  "reception",
  "workers",
].map((key) => STAFF_ASSIGNABLE_ROLES.find((role) => role.key === key)!);

export type ChartDepartmentKey = (typeof CHART_DEPARTMENTS)[number]["key"];

export function isChartDepartment(value: string): value is ChartDepartmentKey {
  return CHART_DEPARTMENTS.some((department) => department.key === value);
}

/** The positions a new company's chart starts with. */
export const DEFAULT_POSITIONS: {
  block: string;
  title: string;
  signsAs: SigningRole | null;
}[] = [
  { block: OWNERS_BLOCK, title: "CEO & Managing Partner", signsAs: null },
  { block: OWNERS_BLOCK, title: "Managing Director", signsAs: null },
  { block: ACCOUNTS_DEPARTMENT, title: "Accountant", signsAs: "accountant" },
  { block: "admin", title: "Admin", signsAs: "admin" },
  { block: "admin", title: "Purchaser", signsAs: "purchaser" },
  { block: "workers", title: "Foreman", signsAs: "foreman" },
];

export const MAX_TITLE_LENGTH = 60;
