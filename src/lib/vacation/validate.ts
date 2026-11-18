import type { LeaveType, VacationRequestInput } from "@/lib/vacation/types";
import { UserError } from "@/lib/errors";

const LEAVE_TYPE_SET = new Set<LeaveType>([
  "annual",
  "sick",
  "emergency",
  "other",
]);

function clean(value: string): string {
  return value.trim();
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export type NormalizedVacationRequest = VacationRequestInput & {
  startDate: string;
  endDate: string;
  dayCount: number;
};

export function normalizeVacationRequestInput(
  input: VacationRequestInput,
): NormalizedVacationRequest {
  const staffId = clean(input.staffId);
  if (!staffId) {
    throw new UserError("Select an employee.");
  }

  const selectedDates = Array.from(
    new Set(
      (input.selectedDates ?? [])
        .map((value) => clean(value))
        .filter((value) => isIsoDate(value)),
    ),
  ).sort();

  if (selectedDates.length === 0) {
    throw new UserError("Select at least one vacation day.");
  }

  const leaveType = input.leaveType;
  if (!LEAVE_TYPE_SET.has(leaveType)) {
    throw new UserError("Select a leave type.");
  }

  const reason = clean(input.reason);
  if (leaveType === "other" && !reason) {
    throw new UserError("Enter a reason for Other leave.");
  }

  return {
    staffId,
    selectedDates,
    leaveType,
    reason,
    startDate: selectedDates[0]!,
    endDate: selectedDates[selectedDates.length - 1]!,
    dayCount: selectedDates.length,
  };
}
