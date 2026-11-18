import { DEPARTMENT_COLORS } from "@/lib/departments/colors";
import {
  workflowDepartmentLabel,
  type InquiryWorkflowDepartmentKey,
} from "@/lib/inquiries/stages";
import type { InquiryStatus } from "@/lib/inquiries/types";

/** The department that handles something, in that department's colour. */
export function DepartmentChip({
  department,
}: {
  department: InquiryWorkflowDepartmentKey;
}) {
  const colors = DEPARTMENT_COLORS[department];
  return (
    <span className={`chip ring-1 ring-inset ${colors.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
      {workflowDepartmentLabel(department)}
    </span>
  );
}

const STATUS_CHIPS: Record<InquiryStatus, { label: string; chip: string }> = {
  open: { label: "Open", chip: "bg-blue-50 text-blue-800 ring-blue-200" },
  completed: {
    label: "Completed",
    chip: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  cancelled: {
    label: "Closed as lost",
    chip: "bg-slate-100 text-slate-700 ring-slate-300",
  },
};

export function StatusChip({ status }: { status: InquiryStatus }) {
  const { label, chip } = STATUS_CHIPS[status];
  return <span className={`chip ring-1 ring-inset ${chip}`}>{label}</span>;
}
