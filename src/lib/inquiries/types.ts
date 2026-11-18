import type {
  InquiryApprovalRoleKey,
  InquiryStageKey,
  InquiryWorkflowDepartmentKey,
  InquiryWorkflowMap,
} from "@/lib/inquiries/stages";

export type { InquiryWorkflowMap };

export type InquiryLineItemInput = {
  description: string;
  quantity: string;
  unitPrice: string;
};

export type InquiryCreateInput = {
  customerName: string;
  contact: string;
  deliveryExpectedOn: string;
  notes: string;
  lineItems: InquiryLineItemInput[];
};

export type InquiryUpdateInput = InquiryCreateInput;

export type InquiryLineItemView = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  sortOrder: number;
};

export type InquiryCommentView = {
  id: string;
  body: string;
  authorUserId: string;
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

export type InquiryView = {
  id: string;
  organizationId: string;
  customerName: string;
  contact: string;
  deliveryExpectedOn: string;
  notes: string;
  currentStage: InquiryStageKey;
  owningDepartmentKey: InquiryWorkflowDepartmentKey;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  source: "reception_visitor" | "admin";
  sourceVisitorId: string | null;
  createdByUserId: string;
  createdByName: string;
  approvalRequired: boolean;
  approvalRequiredBy: InquiryApprovalRoleKey | "";
  currentStageApproved: boolean;
  canApproveCurrentStage: boolean;
  lineItems: InquiryLineItemView[];
  comments: InquiryCommentView[];
  activityLogs: InquiryActivityLogView[];
  createdAt: string;
  updatedAt: string;
};
