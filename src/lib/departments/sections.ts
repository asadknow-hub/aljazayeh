import {
  FORM_DEFINITIONS,
  formTypesRaisedIn,
  type FormType,
} from "@/lib/forms/definitions";
import type { InquiryWorkflowDepartmentKey } from "@/lib/inquiries/stages";

/** The company's bank accounts, kept by Accounts. */
export const BANKS_SECTION = "banks";

export type DepartmentSection = "inquiries" | FormType | typeof BANKS_SECTION;

/**
 * A department workspace's sidebar: the inquiries, then the forms it raises;
 * Accounts also keeps the bank accounts.
 */
export function departmentSections(
  department: InquiryWorkflowDepartmentKey,
): { key: DepartmentSection; label: string }[] {
  return [
    { key: "inquiries", label: "Inquiries" },
    ...formTypesRaisedIn(department).map((type) => ({
      key: type,
      label: FORM_DEFINITIONS[type].listLabel,
    })),
    ...(department === "accounts"
      ? [{ key: BANKS_SECTION, label: "Bank accounts" } as const]
      : []),
  ];
}
