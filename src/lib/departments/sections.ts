import {
  FORM_DEFINITIONS,
  formTypesRaisedIn,
  type FormType,
} from "@/lib/forms/definitions";
import type { InquiryWorkflowDepartmentKey } from "@/lib/inquiries/stages";

export type DepartmentSection = "inquiries" | "invoice" | FormType;

/** A department workspace's sidebar: the pipeline, then the forms it raises. */
export function departmentSections(
  department: InquiryWorkflowDepartmentKey,
): { key: DepartmentSection; label: string }[] {
  return [
    { key: "inquiries", label: "Inquiries" },
    { key: "invoice", label: "Invoice" },
    ...formTypesRaisedIn(department).map((type) => ({
      key: type,
      label: FORM_DEFINITIONS[type].listLabel,
    })),
  ];
}
