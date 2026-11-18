import { daysInclusive, isIsoDate } from "@/lib/datetime/calendar";
import { UserError } from "@/lib/errors";
import { LEAVE_TYPES, type VacationRequestInput } from "@/lib/vacation/types";
import { isUuid } from "@/lib/ids";

export type NormalizedVacationRequest = Omit<
  VacationRequestInput,
  "leaveAvailableDays"
> & {
  dayCount: number;
  leaveAvailableDays: number | null;
};

export function normalizeVacationRequestInput(
  input: VacationRequestInput,
): NormalizedVacationRequest {
  const staffId = input.staffId.trim();
  if (!isUuid(staffId)) {
    throw new UserError("Select an employee.");
  }

  if (!isIsoDate(input.startDate) || !isIsoDate(input.endDate)) {
    throw new UserError("Select the first and last day of the leave.");
  }
  if (input.endDate < input.startDate) {
    throw new UserError("The last day cannot be before the first day.");
  }

  if (!LEAVE_TYPES.some((type) => type.value === input.leaveType)) {
    throw new UserError("Select a leave type.");
  }
  const reason = input.reason.trim();
  if (input.leaveType === "other" && !reason) {
    throw new UserError("Enter a reason for Other leave.");
  }

  const available = input.leaveAvailableDays.trim();
  if (available && !/^\d{1,3}$/.test(available)) {
    throw new UserError("Leave available must be a number of days.");
  }

  return {
    staffId,
    startDate: input.startDate,
    endDate: input.endDate,
    dayCount: daysInclusive(input.startDate, input.endDate),
    leaveType: input.leaveType,
    reason,
    jobHandledBy: input.jobHandledBy.trim(),
    leaveAvailableDays: available ? Number(available) : null,
    officeComments: input.officeComments.trim(),
  };
}
