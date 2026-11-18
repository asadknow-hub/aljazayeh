import {
  INQUIRY_STAGES,
  isInquiryApprovalRoleKey,
  isInquiryWorkflowDepartmentKey,
  type InquiryStageKey,
  type InquiryWorkflowMap,
  type InquiryWorkflowStageConfig,
} from "@/lib/inquiries/stages";
import type {
  InquiryCreateInput,
  InquiryLineItemInput,
} from "@/lib/inquiries/types";
import { UserError } from "@/lib/errors";

function clean(value: string): string {
  return value.trim();
}

function normalizeLineItems(
  items: InquiryLineItemInput[],
): InquiryLineItemInput[] {
  return (items ?? [])
    .map((item) => ({
      description: clean(item.description),
      quantity: clean(item.quantity) || "1",
      unitPrice: clean(item.unitPrice) || "0",
    }))
    .filter(
      (item) =>
        item.description ||
        Number(item.quantity) !== 0 ||
        Number(item.unitPrice) !== 0,
    )
    .map((item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      if (Number.isNaN(quantity) || quantity < 0) {
        throw new UserError("Line item quantity must be a valid number.");
      }
      if (Number.isNaN(unitPrice) || unitPrice < 0) {
        throw new UserError("Line item price must be a valid number.");
      }
      return {
        description: item.description || "Item",
        quantity: quantity.toFixed(2),
        unitPrice: unitPrice.toFixed(2),
      };
    });
}

export function normalizeInquiryCreateInput(
  input: InquiryCreateInput,
): InquiryCreateInput {
  const customerName = clean(input.customerName);
  if (!customerName) {
    throw new UserError("Enter a customer name.");
  }

  const deliveryExpectedOn = clean(input.deliveryExpectedOn);
  if (deliveryExpectedOn && !/^\d{4}-\d{2}-\d{2}$/.test(deliveryExpectedOn)) {
    throw new UserError("Delivery expected date is invalid.");
  }

  return {
    customerName,
    contact: clean(input.contact),
    deliveryExpectedOn,
    notes: clean(input.notes),
    lineItems: normalizeLineItems(input.lineItems),
  };
}

export function normalizeInquiryWorkflowMap(
  input: Partial<Record<InquiryStageKey, Partial<InquiryWorkflowStageConfig>>>,
): InquiryWorkflowMap {
  const map = {} as InquiryWorkflowMap;

  for (const stage of INQUIRY_STAGES) {
    const raw = input[stage.key] ?? {};
    const departmentKey = raw.departmentKey ?? "admin";
    if (!isInquiryWorkflowDepartmentKey(departmentKey)) {
      throw new UserError(`Invalid department for ${stage.label}.`);
    }

    const approvalRequired = Boolean(raw.approvalRequired);
    let approvalRequiredBy: InquiryWorkflowStageConfig["approvalRequiredBy"] =
      "";

    if (approvalRequired) {
      const role = raw.approvalRequiredBy ?? "";
      if (!role || !isInquiryApprovalRoleKey(role)) {
        throw new UserError(
          `Select who must approve ${stage.label} when approval is required.`,
        );
      }
      approvalRequiredBy = role;
    }

    map[stage.key] = {
      departmentKey,
      approvalRequired,
      approvalRequiredBy,
    };
  }

  return map;
}
