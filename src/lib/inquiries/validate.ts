import {
  INQUIRY_STAGES,
  isInquiryWorkflowDepartmentKey,
  type InquiryStageKey,
  type InquiryWorkflowMap,
  type InquiryWorkflowStageConfig,
} from "@/lib/inquiries/stages";
import { STAGE_DEFINITIONS } from "@/lib/inquiries/stage-forms";
import type {
  InquiryLineItemInput,
  StageTables,
} from "@/lib/inquiries/types";
import { UserError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";

const MAX_TEXT_LENGTH = 4000;

function numberOrThrow(value: string, label: string): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new UserError(`${label} must be a number.`);
  }
  return parsed;
}

/**
 * Tidy the answers of one step and reject values that make no sense (a word
 * where a date belongs). Answers the step does not ask for are dropped.
 */
export function normalizeStageFields(
  stage: InquiryStageKey,
  raw: Record<string, string>,
): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const field of STAGE_DEFINITIONS[stage].fields) {
    const value = String(raw?.[field.key] ?? "").trim();
    if (!value) {
      fields[field.key] = "";
      continue;
    }
    if (value.length > MAX_TEXT_LENGTH) {
      throw new UserError(`${field.label} is too long.`);
    }

    switch (field.type) {
      case "date":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          throw new UserError(`${field.label} is not a valid date.`);
        }
        fields[field.key] = value;
        break;
      case "time":
        if (!/^\d{2}:\d{2}$/.test(value)) {
          throw new UserError(`${field.label} is not a valid time.`);
        }
        fields[field.key] = value;
        break;
      case "amount":
        fields[field.key] = numberOrThrow(value, field.label).toFixed(2);
        break;
      case "number":
        fields[field.key] = String(numberOrThrow(value, field.label));
        break;
      case "choice":
        if (!field.options?.some((option) => option.value === value)) {
          throw new UserError(`Choose one of the options for ${field.label}.`);
        }
        fields[field.key] = value;
        break;
      case "file":
        if (!isUuid(value)) {
          throw new UserError(`Upload ${field.label} again.`);
        }
        fields[field.key] = value;
        break;
      case "yesno":
        fields[field.key] = value === "yes" ? "yes" : "";
        break;
      default:
        fields[field.key] = value;
    }
  }

  return fields;
}

export function normalizeLineItems(
  items: InquiryLineItemInput[],
): InquiryLineItemInput[] {
  return (items ?? [])
    .map((item) => ({
      id: item.id,
      description: String(item.description ?? "").trim(),
      quantity: String(item.quantity ?? "").trim(),
      unit: String(item.unit ?? "").trim(),
      unitPrice: String(item.unitPrice ?? "").trim(),
      deliveredQuantity: String(item.deliveredQuantity ?? "").trim(),
      details: Object.fromEntries(
        Object.entries(item.details ?? {}).map(([key, value]) => [
          key,
          String(value ?? "").trim().slice(0, MAX_TEXT_LENGTH),
        ]),
      ),
    }))
    // A row left completely blank was never meant to be an item.
    .filter((item) => item.id || item.description || Number(item.unitPrice))
    .map((item) => {
      if (!item.description) {
        throw new UserError("Describe every item, or remove the empty row.");
      }
      return {
        id: item.id,
        description: item.description,
        quantity: numberOrThrow(item.quantity || "1", "Quantity").toFixed(2),
        unit: item.unit || "Nos",
        unitPrice: numberOrThrow(item.unitPrice || "0", "Price").toFixed(2),
        deliveredQuantity: item.deliveredQuantity
          ? numberOrThrow(item.deliveredQuantity, "Delivered quantity").toFixed(2)
          : "",
        details: item.details,
      };
    });
}

/**
 * Tidy the lists a step keeps of its own. Only the lists and columns the
 * step defines are kept, and rows left completely blank are dropped.
 */
export function normalizeStageTables(
  stage: InquiryStageKey,
  raw: StageTables | undefined,
): StageTables {
  const tables: StageTables = {};

  for (const [name, table] of Object.entries(STAGE_DEFINITIONS[stage].tables)) {
    tables[name] = (raw?.[name] ?? [])
      .map((row) =>
        Object.fromEntries(
          table.columns.map((column) => {
            const value = String(row?.[column.key] ?? "").trim();
            if (value.length > MAX_TEXT_LENGTH) {
              throw new UserError(`${column.label} is too long.`);
            }
            return [
              column.key,
              column.numeric && value
                ? numberOrThrow(value, column.label).toFixed(2)
                : value,
            ];
          }),
        ),
      )
      .filter((row) => Object.values(row).some(Boolean));
  }

  return tables;
}

export function normalizeInquiryWorkflowMap(
  input: Partial<Record<InquiryStageKey, Partial<InquiryWorkflowStageConfig>>>,
  /** What the company has: its departments and who can approve a step. */
  company: { departments: ReadonlySet<string>; approvers: ReadonlySet<string> },
): InquiryWorkflowMap {
  const map = {} as InquiryWorkflowMap;

  for (const stage of INQUIRY_STAGES) {
    const raw = input[stage.key] ?? {};
    const departmentKey = raw.departmentKey ?? "admin";
    if (
      !isInquiryWorkflowDepartmentKey(departmentKey) ||
      !company.departments.has(departmentKey)
    ) {
      throw new UserError(`Choose a department for ${stage.label}.`);
    }

    const approvalRequired = Boolean(raw.approvalRequired);
    let approvalRequiredBy = "";

    if (approvalRequired) {
      approvalRequiredBy = raw.approvalRequiredBy ?? "";
      if (!company.approvers.has(approvalRequiredBy)) {
        throw new UserError(
          `Select who must approve ${stage.label} when approval is required.`,
        );
      }
    }

    map[stage.key] = {
      departmentKey,
      approvalRequired,
      approvalRequiredBy,
    };
  }

  return map;
}
