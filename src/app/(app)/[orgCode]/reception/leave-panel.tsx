"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { unwrap } from "@/lib/actions/result";
import { daysInclusive, isIsoDate } from "@/lib/datetime/calendar";
import { formatLeavePeriod } from "@/lib/datetime/format";
import type { StaffOption } from "@/lib/staff/types";
import { createVacationRequestAction } from "@/lib/vacation/actions";
import {
  LEAVE_TYPES,
  filterVacationsByList,
  leaveTypeLabel,
  vacationDayCountLabel,
  vacationStatusLabel,
  type VacationListFilter,
  type VacationRequestInput,
  type VacationRequestView,
} from "@/lib/vacation/types";

const FILTERS: { key: VacationListFilter; label: string; empty: string }[] = [
  { key: "active", label: "Active", empty: "No active leave right now." },
  { key: "completed", label: "Completed", empty: "No completed leave yet." },
  { key: "rejected", label: "Rejected", empty: "No rejected requests." },
];

const emptyForm: VacationRequestInput = {
  staffId: "",
  startDate: "",
  endDate: "",
  leaveType: "annual",
  reason: "",
  jobHandledBy: "",
  leaveAvailableDays: "",
  officeComments: "",
};

const inputClass =
  "border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-header";
const labelClass = "text-[12px] font-medium text-zinc-700";

/** Reception → Vacation: raise leave requests and follow their approval. */
export function LeavePanel({
  orgCode,
  today,
  staffOptions,
  requests,
}: {
  orgCode: string;
  today: string;
  staffOptions: StaffOption[];
  requests: VacationRequestView[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<VacationListFilter>("active");
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const visible = useMemo(
    () => filterVacationsByList(requests, filter, today),
    [requests, filter, today],
  );
  const activeStaff = staffOptions.filter((item) => item.status === "active");
  const days =
    isIsoDate(form.startDate) &&
    isIsoDate(form.endDate) &&
    form.endDate >= form.startDate
      ? daysInclusive(form.startDate, form.endDate)
      : null;

  const set = (patch: Partial<VacationRequestInput>) =>
    setForm((current) => ({ ...current, ...patch }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const created = await unwrap(createVacationRequestAction(orgCode, form));
      // Straight to the form, where the signatures are collected.
      router.push(`/${orgCode}/leave/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-zinc-900">
            Vacation
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Raise a leave request for an employee and follow its approval.
          </p>
        </div>
        <button
          type="button"
          disabled={activeStaff.length === 0}
          onClick={() => {
            setForm(emptyForm);
            setError(null);
            setEditorOpen(true);
          }}
          className="bg-header px-3 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control disabled:opacity-45"
        >
          New leave request
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={[
              "border px-3 py-1.5 text-sm font-medium transition",
              filter === item.key
                ? "border-header bg-header text-header-fg"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 border border-zinc-300 bg-white">
        {visible.length === 0 ? (
          <p className="px-4 py-5 text-sm text-zinc-600 sm:px-5">
            {FILTERS.find((item) => item.key === filter)!.empty}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {visible.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/${orgCode}/leave/${item.id}`}
                  className="flex flex-col gap-1 px-4 py-3 transition hover:bg-zinc-50 sm:flex-row sm:items-start sm:justify-between sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-zinc-900">
                      {item.staffName}
                      {item.staffJobTitle ? ` · ${item.staffJobTitle}` : ""}
                    </span>
                    <span className="mt-0.5 block text-sm text-zinc-600">
                      {leaveTypeLabel(item.leaveType)} ·{" "}
                      {formatLeavePeriod(
                        item.startDate,
                        item.endDate,
                        item.dayCount,
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-zinc-700">
                    {filter === "completed"
                      ? "Completed"
                      : vacationStatusLabel(item.status)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {activeStaff.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">
          Add staff members first before raising a leave request.
        </p>
      ) : null}

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <form
            onSubmit={onSubmit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-request-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-auto border border-zinc-300 bg-white shadow-lg"
          >
            <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
              <h3
                id="leave-request-title"
                className="font-display text-base font-semibold text-zinc-900"
              >
                New leave request
              </h3>
              <p className="mt-1 text-sm text-zinc-600">
                The employee&apos;s details come from their staff record. After
                saving, the form goes round for signatures.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className={labelClass}>Employee</span>
                <select
                  required
                  value={form.staffId}
                  onChange={(event) => set({ staffId: event.target.value })}
                  className={inputClass}
                >
                  <option value="">Select an employee</option>
                  {activeStaff.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.fullName}
                      {staff.jobTitle ? ` · ${staff.jobTitle}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Leave from</span>
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(event) => set({ startDate: event.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Last day of leave</span>
                <input
                  type="date"
                  required
                  min={form.startDate || undefined}
                  value={form.endDate}
                  onChange={(event) => set({ endDate: event.target.value })}
                  className={inputClass}
                />
              </label>
              <p className="text-sm text-zinc-600 sm:col-span-2">
                {days === null
                  ? "Choose both dates to see the number of days."
                  : `Leave requested for ${vacationDayCountLabel(days)}. Back on duty the day after the last day.`}
              </p>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Type of leave</span>
                <select
                  value={form.leaveType}
                  onChange={(event) =>
                    set({
                      leaveType: event.target
                        .value as VacationRequestInput["leaveType"],
                    })
                  }
                  className={inputClass}
                >
                  {LEAVE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Reason</span>
                <input
                  value={form.reason}
                  onChange={(event) => set({ reason: event.target.value })}
                  className={inputClass}
                />
              </label>

              <p className="border-t border-zinc-200 pt-3 text-sm font-medium text-zinc-900 sm:col-span-2">
                Office use (optional)
              </p>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Job to be handled by</span>
                <input
                  value={form.jobHandledBy}
                  onChange={(event) =>
                    set({ jobHandledBy: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Leave available (days)</span>
                <input
                  inputMode="numeric"
                  value={form.leaveAvailableDays}
                  onChange={(event) =>
                    set({ leaveAvailableDays: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className={labelClass}>Comments</span>
                <input
                  value={form.officeComments}
                  onChange={(event) =>
                    set({ officeComments: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
            </div>

            {error ? (
              <p
                className="border-t border-zinc-200 px-4 py-3 text-sm text-red-700 sm:px-5"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3 sm:px-5">
              <button
                type="button"
                disabled={pending}
                onClick={() => setEditorOpen(false)}
                className="border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-45"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="bg-header px-3 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control disabled:opacity-45"
              >
                {pending ? "Saving…" : "Save and send for signatures"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
