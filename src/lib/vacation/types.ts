export const LEAVE_TYPES = [
  { value: "annual", label: "Annual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "emergency", label: "Emergency Leave" },
  { value: "other", label: "Other" },
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number]["value"];

export type VacationStatus = "pending" | "approved" | "rejected";

export type VacationRequestInput = {
  staffId: string;
  selectedDates: string[];
  leaveType: LeaveType;
  reason: string;
};

export type VacationRequestView = {
  id: string;
  organizationId: string;
  staffId: string;
  staffName: string;
  staffJobTitle: string;
  startDate: string;
  endDate: string;
  selectedDates: string[];
  dayCount: number;
  leaveType: LeaveType;
  reason: string;
  status: VacationStatus;
  requestedByUserId: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNote: string;
  createdAt: string;
  updatedAt: string;
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
  const safe = Math.max(0, count);
  return safe === 1 ? "1 day" : `${safe} days`;
}

export type VacationListFilter = "active" | "completed" | "rejected";

function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function vacationListBucket(
  item: Pick<VacationRequestView, "status" | "endDate">,
  today = todayIsoDate(),
): VacationListFilter {
  if (item.status === "rejected") return "rejected";
  if (item.status === "pending") return "active";
  if (item.endDate < today) return "completed";
  return "active";
}

export function filterVacationsByList(
  items: VacationRequestView[],
  filter: VacationListFilter,
): VacationRequestView[] {
  return items.filter((item) => vacationListBucket(item) === filter);
}

export function parseSelectedDatesJson(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item))
      .sort();
  } catch {
    return [];
  }
}
