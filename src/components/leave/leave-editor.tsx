"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DocumentSplit } from "@/components/documents/document-split";
import { LeaveForm } from "@/components/leave/leave-form";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { useToast } from "@/components/providers/toast-provider";
import { AlertIcon, ArrowRightIcon } from "@/components/ui/icons";
import { unwrap } from "@/lib/actions/result";
import { firstApprover } from "@/lib/signoffs/chains";
import {
  addDays,
  daysInclusive,
  durationInYearsAndMonths,
  isIsoDate,
} from "@/lib/datetime/calendar";
import { createVacationRequestAction } from "@/lib/vacation/actions";
import {
  LEAVE_TYPES,
  vacationDayCountLabel,
  type LeaveDocument,
  type LeaveDraftContext,
  type VacationRequestInput,
} from "@/lib/vacation/types";

const emptyRequest: VacationRequestInput = {
  staffId: "",
  startDate: "",
  endDate: "",
  leaveType: "annual",
  reason: "",
  jobHandledBy: "",
  leaveAvailableDays: "",
  officeComments: "",
};

/** The leave form as it will print, from what has been typed so far. */
function previewOf(
  context: LeaveDraftContext,
  request: VacationRequestInput,
  now: string,
): LeaveDocument {
  const employee = context.employees.find(
    (item) => item.id === request.staffId,
  );
  const datesSet =
    isIsoDate(request.startDate) &&
    isIsoDate(request.endDate) &&
    request.endDate >= request.startDate;
  const lastLeaveEnd = isIsoDate(request.startDate)
    ? employee?.approvedLeaveEnds
        .filter((end) => end < request.startDate)
        .sort()
        .at(-1)
    : undefined;

  return {
    id: "",
    staffId: request.staffId,
    staffName: employee?.fullName ?? "",
    staffJobTitle: employee?.designation ?? "",
    startDate: request.startDate,
    endDate: request.endDate,
    returnDate: isIsoDate(request.endDate) ? addDays(request.endDate, 1) : "",
    dayCount: datesSet ? daysInclusive(request.startDate, request.endDate) : 0,
    leaveType: request.leaveType,
    reason: request.reason,
    status: "pending",
    createdAt: now,
    company: context.company,
    employee: {
      designation: employee?.designation ?? "",
      department: employee?.department ?? "",
      localContact: employee?.localContact ?? "",
      homeCountryContact: employee?.homeCountryContact ?? "",
      passportNumber: employee?.passportNumber ?? "",
      joinedOn: employee?.joinedOn ?? "",
      workingDuration:
        employee?.joinedOn && isIsoDate(request.startDate)
          ? durationInYearsAndMonths(employee.joinedOn, request.startDate)
          : "",
      previousReturn: lastLeaveEnd ? addDays(lastLeaveEnd, 1) : "",
    },
    jobHandledBy: request.jobHandledBy,
    leaveAvailableDays: /^\d+$/.test(request.leaveAvailableDays.trim())
      ? Number(request.leaveAvailableDays)
      : null,
    officeComments: request.officeComments,
    signoffs: context.signoffs,
  };
}

/**
 * A new leave request: its details on the left, the leave form filling in on
 * the right. Sending it starts the round of approvals.
 */
export function LeaveEditor({
  orgCode,
  context,
  now,
  listHref,
}: {
  orgCode: string;
  context: LeaveDraftContext;
  /** The moment the page was opened, as the form's date. */
  now: string;
  listHref: string;
}) {
  usePageTitle("New Leave Request");
  const router = useRouter();
  const { showToast } = useToast();
  const [request, setRequest] = useState(emptyRequest);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = (patch: Partial<VacationRequestInput>) =>
    setRequest((current) => ({ ...current, ...patch }));
  const preview = previewOf(context, request, now);
  const approver = firstApprover(context.signoffs.steps);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const created = await unwrap(
        createVacationRequestAction(orgCode, request),
      );
      showToast("Sent for approval");
      // Replaces this page, so going back does not return to a used form.
      router.replace(`/${orgCode}/leave/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send it.");
      setPending(false);
    }
  }

  return (
    <DocumentSplit
      backHref={listHref}
      side={
        // Never taller than the screen: the fields scroll inside the card, so
        // its heading and its buttons stay in view.
        <form
          onSubmit={onSubmit}
          className="card flex flex-col xl:max-h-[calc(100dvh-5rem)]"
        >
          <div className="shrink-0 border-b border-slate-200 px-4 py-3">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              New leave request
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Fill in here. The form beside it fills in as you type; the
              employee&apos;s details come from their staff record.
            </p>
          </div>

          <div className="grid min-h-0 grid-cols-2 gap-x-3 gap-y-3.5 overflow-y-auto px-4 py-4">
            <label className="col-span-2 flex flex-col gap-1.5">
              <span className="field-label">
                Employee<span className="ml-0.5 text-red-600">*</span>
              </span>
              <select
                required
                value={request.staffId}
                onChange={(event) => set({ staffId: event.target.value })}
                className="field w-full"
              >
                <option value="">Select an employee</option>
                {context.employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName}
                    {employee.designation ? ` · ${employee.designation}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="field-label">
                Leave from<span className="ml-0.5 text-red-600">*</span>
              </span>
              <input
                type="date"
                required
                value={request.startDate}
                onChange={(event) => set({ startDate: event.target.value })}
                className="field w-full"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="field-label">
                Last day of leave<span className="ml-0.5 text-red-600">*</span>
              </span>
              <input
                type="date"
                required
                min={request.startDate || undefined}
                value={request.endDate}
                onChange={(event) => set({ endDate: event.target.value })}
                className="field w-full"
              />
            </label>
            <p className="col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {preview.dayCount === 0
                ? "Choose both dates to see the number of days."
                : `${vacationDayCountLabel(preview.dayCount)} of leave. Back on duty the day after the last day.`}
            </p>
            <label className="col-span-2 flex flex-col gap-1.5">
              <span className="field-label">Type of leave</span>
              <select
                value={request.leaveType}
                onChange={(event) =>
                  set({
                    leaveType: event.target
                      .value as VacationRequestInput["leaveType"],
                  })
                }
                className="field w-full"
              >
                {LEAVE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-2 flex flex-col gap-1.5">
              <span className="field-label">Reason</span>
              <input
                value={request.reason}
                onChange={(event) => set({ reason: event.target.value })}
                className="field w-full"
              />
            </label>

            <h3 className="col-span-2 mt-1 border-b border-slate-200 pb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Office use (optional)
            </h3>
            <label className="col-span-2 flex flex-col gap-1.5">
              <span className="field-label">Job to be handled by</span>
              <input
                value={request.jobHandledBy}
                onChange={(event) => set({ jobHandledBy: event.target.value })}
                className="field w-full"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Leave available (days)</span>
              <input
                inputMode="numeric"
                value={request.leaveAvailableDays}
                onChange={(event) =>
                  set({ leaveAvailableDays: event.target.value })
                }
                className="field w-full"
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1.5">
              <span className="field-label">Comments</span>
              <input
                value={request.officeComments}
                onChange={(event) =>
                  set({ officeComments: event.target.value })
                }
                className="field w-full"
              />
            </label>
          </div>

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}

          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
            <Link href={listHref} className="btn btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary !items-center !py-1.5 text-left"
            >
              <span className="flex flex-col leading-tight">
                <span>{pending ? "Sending…" : "Send for Approval"}</span>
                {approver ? (
                  <span className="text-xs font-normal text-blue-100">
                    Goes to {approver.expectedName || approver.label}
                  </span>
                ) : null}
              </span>
              <ArrowRightIcon className="h-5 w-5" />
            </button>
          </div>
        </form>
      }
    >
      <LeaveForm leave={preview} />
    </DocumentSplit>
  );
}
