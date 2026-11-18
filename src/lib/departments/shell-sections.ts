import type { InquiryWorkflowDepartmentKey } from "@/lib/inquiries/stages";

export const ADMIN_SECTIONS = [
  { key: "inquiries", label: "Inquiries" },
  { key: "invoice", label: "Invoice" },
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number]["key"];

export const DEPT_WORKFLOW_SECTIONS = [
  { key: "inquiries", label: "Inquiries" },
  { key: "invoice", label: "Invoice" },
] as const;

export type DeptWorkflowSection = (typeof DEPT_WORKFLOW_SECTIONS)[number]["key"];

/** @deprecated Use DEPT_WORKFLOW_SECTIONS */
export const DEPT_INVOICE_SECTIONS = DEPT_WORKFLOW_SECTIONS;
/** @deprecated Use DeptWorkflowSection */
export type DeptInvoiceSection = DeptWorkflowSection;

export function isAdminSection(value: string): value is AdminSection {
  return ADMIN_SECTIONS.some((item) => item.key === value);
}

export function isDeptWorkflowSection(
  value: string,
): value is DeptWorkflowSection {
  return DEPT_WORKFLOW_SECTIONS.some((item) => item.key === value);
}

/** @deprecated Use isDeptWorkflowSection */
export const isDeptInvoiceSection = isDeptWorkflowSection;

export const WORKFLOW_DEPT_PATH: Record<
  InquiryWorkflowDepartmentKey,
  string
> = {
  admin: "admin",
  sales: "sales",
  accounts: "accounts",
  engineering: "engineering",
};
