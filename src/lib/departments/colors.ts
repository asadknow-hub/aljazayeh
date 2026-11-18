import type { InquiryWorkflowDepartmentKey } from "@/lib/inquiries/stages";

/**
 * Each department has one colour, used wherever work is labelled with the
 * department that handles it. The class names are written out in full so the
 * stylesheet includes them.
 */
export const DEPARTMENT_COLORS: Record<
  InquiryWorkflowDepartmentKey,
  { chip: string; dot: string; text: string }
> = {
  sales: {
    chip: "bg-blue-50 text-blue-800 ring-blue-200",
    dot: "bg-blue-500",
    text: "text-blue-700",
  },
  admin: {
    chip: "bg-teal-50 text-teal-800 ring-teal-200",
    dot: "bg-teal-500",
    text: "text-teal-700",
  },
  engineering: {
    chip: "bg-pink-50 text-pink-800 ring-pink-200",
    dot: "bg-pink-500",
    text: "text-pink-700",
  },
  accounts: {
    chip: "bg-violet-50 text-violet-800 ring-violet-200",
    dot: "bg-violet-500",
    text: "text-violet-700",
  },
};
