export const INQUIRY_STAGES = [
  { key: "inquiry", label: "Inquiry" },
  { key: "quotation", label: "Quotation" },
  { key: "lpo_in_or_out", label: "LPO In or Out" },
  { key: "proforma_invoice", label: "Proforma Invoice" },
  { key: "job_card", label: "Job Card" },
  { key: "progress_invoice", label: "Progress Invoice" },
  { key: "delivery_note", label: "Delivery Note" },
  { key: "tax_invoice", label: "Tax Invoice" },
  { key: "commercial_invoice", label: "Commercial Invoice" },
  { key: "receipt_voucher", label: "Receipt Voucher" },
] as const;

export type InquiryStageKey = (typeof INQUIRY_STAGES)[number]["key"];

/** Steps that only jobs shipped abroad go through. */
const EXPORT_ONLY_STAGES: readonly InquiryStageKey[] = ["commercial_invoice"];

export function isExportOnlyStage(key: InquiryStageKey): boolean {
  return EXPORT_ONLY_STAGES.includes(key);
}

/**
 * The steps one job goes through, in order. A local job has nine; an export
 * job has the Commercial Invoice as step 9 and the Receipt Voucher as 10.
 */
export function stagesForJob(jobType: string) {
  return INQUIRY_STAGES.filter(
    (stage) => jobType === "export" || !isExportOnlyStage(stage.key),
  );
}

/** A step's number within its job: 1 for the first step. */
export function stageNumber(key: InquiryStageKey, jobType: string): number {
  return stagesForJob(jobType).findIndex((stage) => stage.key === key) + 1;
}

export const INQUIRY_WORKFLOW_DEPARTMENTS = [
  { key: "sales", label: "Sales" },
  { key: "admin", label: "Admin" },
  { key: "engineering", label: "Engineering Department" },
  { key: "accounts", label: "Accounts" },
] as const;

export type InquiryWorkflowDepartmentKey =
  (typeof INQUIRY_WORKFLOW_DEPARTMENTS)[number]["key"];

export const INQUIRY_APPROVAL_ROLES = [
  { key: "management", label: "Management" },
  { key: "engineering", label: "Engineering Department" },
] as const;

export type InquiryApprovalRoleKey =
  (typeof INQUIRY_APPROVAL_ROLES)[number]["key"];

export type InquiryWorkflowStageConfig = {
  departmentKey: InquiryWorkflowDepartmentKey;
  approvalRequired: boolean;
  approvalRequiredBy: InquiryApprovalRoleKey | "";
};

export type InquiryWorkflowMap = Record<
  InquiryStageKey,
  InquiryWorkflowStageConfig
>;

export function isInquiryStageKey(value: string): value is InquiryStageKey {
  return INQUIRY_STAGES.some((stage) => stage.key === value);
}

export function isInquiryWorkflowDepartmentKey(
  value: string,
): value is InquiryWorkflowDepartmentKey {
  return INQUIRY_WORKFLOW_DEPARTMENTS.some((dept) => dept.key === value);
}

export function workflowDepartmentLabel(
  key: InquiryWorkflowDepartmentKey,
): string {
  return (
    INQUIRY_WORKFLOW_DEPARTMENTS.find((dept) => dept.key === key)?.label ?? key
  );
}

export function isInquiryApprovalRoleKey(
  value: string,
): value is InquiryApprovalRoleKey {
  return INQUIRY_APPROVAL_ROLES.some((role) => role.key === value);
}

export function inquiryStageLabel(key: string): string {
  return INQUIRY_STAGES.find((stage) => stage.key === key)?.label ?? key;
}

export function adjacentInquiryStages(
  current: InquiryStageKey,
  jobType: string,
): {
  previous: InquiryStageKey | null;
  next: InquiryStageKey | null;
} {
  const stages = stagesForJob(jobType);
  const index = stages.findIndex((stage) => stage.key === current);
  return {
    previous: index > 0 ? stages[index - 1]!.key : null,
    next:
      index >= 0 && index < stages.length - 1 ? stages[index + 1]!.key : null,
  };
}

export function departmentForStage(
  map: InquiryWorkflowMap,
  stage: InquiryStageKey,
): InquiryWorkflowDepartmentKey {
  return map[stage]?.departmentKey ?? "admin";
}

/**
 * Who prepares each step unless the company chooses otherwise: Accounts for
 * the invoices and the receipt, Admin for everything else, as written on the
 * company's own forms.
 */
const ACCOUNTS_STAGES: readonly InquiryStageKey[] = [
  "proforma_invoice",
  "progress_invoice",
  "tax_invoice",
  "receipt_voucher",
];

export function defaultInquiryWorkflowMap(): InquiryWorkflowMap {
  return Object.fromEntries(
    INQUIRY_STAGES.map((stage) => [
      stage.key,
      {
        departmentKey: ACCOUNTS_STAGES.includes(stage.key)
          ? ("accounts" as const)
          : ("admin" as const),
        approvalRequired: false,
        approvalRequiredBy: "" as const,
      },
    ]),
  ) as InquiryWorkflowMap;
}
