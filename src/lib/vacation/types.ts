import { appDateValue } from "@/lib/datetime/format";
import type { SignoffState } from "@/lib/signoffs/chains";

export const LEAVE_TYPES = [
  { value: "annual", label: "Annual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "emergency", label: "Emergency Leave" },
  { value: "other", label: "Other" },
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number]["value"];

export type VacationStatus = "pending" | "approved" | "rejected";

/** What Reception fills in to raise a leave request. */
export type VacationRequestInput = {
  staffId: string;
  /** First and last day away (YYYY-MM-DD). */
  startDate: string;
  endDate: string;
  leaveType: LeaveType;
  reason: string;
  /** Office use: who covers the job, and the leave balance (optional). */
  jobHandledBy: string;
  leaveAvailableDays: string;
  officeComments: string;
};

export type VacationRequestView = {
  id: string;
  staffId: string;
  staffName: string;
  staffJobTitle: string;
  startDate: string;
  endDate: string;
  /** The day the person is back on duty. */
  returnDate: string;
  dayCount: number;
  leaveType: LeaveType;
  reason: string;
  status: VacationStatus;
  createdAt: string;
};

/** Everything printed on the Leave Request Application form. */
export type LeaveDocument = VacationRequestView & {
  company: { name: string; nameArabic: string; logoImage: string | null };
  employee: {
    designation: string;
    department: string;
    localContact: string;
    homeCountryContact: string;
    passportNumber: string;
    joinedOn: string;
    /** Time with the company when the leave starts. */
    workingDuration: string;
    /** When they last came back from leave, if they have been on any. */
    previousReturn: string;
  };
  jobHandledBy: string;
  leaveAvailableDays: number | null;
  officeComments: string;
  signoffs: SignoffState;
};

export function leaveTypeLabel(type: string): string {
  return LEAVE_TYPES.find((item) => item.value === type)?.label ?? type;
}

export function vacationStatusLabel(status: VacationStatus): string {
  if (status === "pending") return "Awaiting approval";
  if (status === "approved") return "Approved";
  return "Rejected";
}

export function vacationDayCountLabel(count: number): string {
  return count === 1 ? "1 day" : `${count} days`;
}

export type VacationListFilter = "active" | "completed" | "rejected";

function vacationListBucket(
  item: Pick<VacationRequestView, "status" | "endDate">,
  today: string,
): VacationListFilter {
  if (item.status === "rejected") return "rejected";
  if (item.status === "pending") return "active";
  return item.endDate < today ? "completed" : "active";
}

export function filterVacationsByList(
  items: VacationRequestView[],
  filter: VacationListFilter,
  today = appDateValue(),
): VacationRequestView[] {
  return items.filter((item) => vacationListBucket(item, today) === filter);
}

/**
 * What is needed to show a leave request as its form before it is saved:
 * the letterhead, who will sign, and the staff records the form prints.
 */
export type LeaveDraftContext = {
  company: LeaveDocument["company"];
  signoffs: SignoffState;
  employees: {
    id: string;
    fullName: string;
    designation: string;
    department: string;
    localContact: string;
    homeCountryContact: string;
    passportNumber: string;
    joinedOn: string;
    /** Last days of their approved leave so far. */
    approvedLeaveEnds: string[];
  }[];
};
