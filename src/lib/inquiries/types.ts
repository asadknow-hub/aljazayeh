import type {
  InquiryApprovalRoleKey,
  InquiryStageKey,
  InquiryWorkflowDepartmentKey,
  InquiryWorkflowMap,
} from "@/lib/inquiries/stages";
import type { InquiryTotals } from "@/lib/inquiries/stage-forms";

export type { InquiryWorkflowMap };

export type InquiryStatus = "open" | "completed" | "cancelled";

export type InquiryLineItemInput = {
  /** Present for a line that is already saved. */
  id?: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  deliveredQuantity: string;
};

/** What a person typed into one step: its answers and the job's items. */
export type InquiryStageInput = {
  fields: Record<string, string>;
  lineItems: InquiryLineItemInput[];
};

export type InquiryLineItemView = Required<InquiryLineItemInput>;

export type InquiryCommentView = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
};

export type InquiryActivityLogView = {
  id: string;
  label: string;
  detail: string;
  actorName: string | null;
  occurredAt: string;
};

/** An inquiry as it appears in a list. */
export type InquirySummary = {
  id: string;
  number: string;
  title: string;
  customerName: string;
  contact: string;
  deliveryExpectedOn: string;
  jobType: string;
  status: InquiryStatus;
  currentStage: InquiryStageKey;
  /** Whole days it has been at its current step. */
  daysInStage: number;
  /** Still open after the date the customer needs it by. */
  overdue: boolean;
  owningDepartmentKey: InquiryWorkflowDepartmentKey;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  totals: InquiryTotals;
  /** The signed-in person may fill in and move this inquiry. */
  canWork: boolean;
  /** The signed-in person may choose who handles this inquiry. */
  canAssign: boolean;
  createdAt: string;
  updatedAt: string;
};

type InquiryStepState = "done" | "current" | "locked";

/** One step of the process for one inquiry. */
export type InquiryStepView = {
  key: InquiryStageKey;
  /** 1 for the first step. */
  number: number;
  label: string;
  departmentKey: InquiryWorkflowDepartmentKey;
  state: InquiryStepState;
  /** This step's own document number, once it has one. */
  documentNumber: string;
  fields: Record<string, string>;
  completedAt: string | null;
  completedByName: string | null;
  approvalRequired: boolean;
  approvalRequiredBy: InquiryApprovalRoleKey | "";
};

/** The whole inquiry, as shown on its own page. */
export type InquiryView = InquirySummary & {
  closeReason: string;
  closedAt: string | null;
  source: "reception_visitor" | "admin";
  createdByName: string;
  steps: InquiryStepView[];
  lineItems: InquiryLineItemView[];
  currentStageApproved: boolean;
  canApproveCurrentStage: boolean;
  /** The signed-in person may close this inquiry as lost, or reopen it. */
  canClose: boolean;
  comments: InquiryCommentView[];
  activityLogs: InquiryActivityLogView[];
};

export type AssignableStaff = {
  id: string;
  fullName: string;
  jobTitle: string;
};
