"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { DurationCalendar } from "@/components/vacation/duration-calendar";
import {
  formatFriendlyDateTime,
  formatVacationDuration,
} from "@/lib/datetime/format";
import { VisitorsPanel } from "@/app/(app)/[orgCode]/reception/visitors-panel";
import { useServerState } from "@/lib/react/use-server-state";
import { createVacationRequestAction } from "@/lib/vacation/actions";
import {
  RECEPTION_SECTIONS,
  type ReceptionSection,
} from "@/lib/reception/sections";
import {
  LEAVE_TYPES,
  filterVacationsByList,
  leaveTypeLabel,
  vacationDayCountLabel,
  vacationStatusLabel,
  type LeaveType,
  type VacationListFilter,
  type VacationRequestInput,
  type VacationRequestView,
} from "@/lib/vacation/types";
import type { VisitorLogView } from "@/lib/visitors/types";

type StaffOption = {
  id: string;
  fullName: string;
  jobTitle: string;
  status: string;
};

type ReceptionClientProps = {
  org: { id: string; name: string; code: string };
  staffOptions: StaffOption[];
  initialVacations: VacationRequestView[];
  initialVisitors: VisitorLogView[];
  initialSection: ReceptionSection;
};

const emptyForm: VacationRequestInput = {
  staffId: "",
  selectedDates: [],
  leaveType: "annual",
  reason: "",
};

const FILTER_COPY: Record<
  VacationListFilter,
  { title: string; empty: string }
> = {
  active: {
    title: "Active vacations",
    empty: "No active vacations right now.",
  },
  completed: {
    title: "Completed vacations",
    empty: "No completed vacations yet.",
  },
  rejected: {
    title: "Rejected vacations",
    empty: "No rejected vacation requests.",
  },
};

export function ReceptionClient({
  org,
  staffOptions,
  initialVacations,
  initialVisitors,
  initialSection,
}: ReceptionClientProps) {
  usePageTitle("Reception");
  const router = useRouter();

  const [section, setSection] = useState<ReceptionSection>(initialSection);
  const [vacations, setVacations] = useServerState(initialVacations);
  const [listFilter, setListFilter] = useState<VacationListFilter>("active");
  const [editorOpen, setEditorOpen] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [createdItem, setCreatedItem] = useState<VacationRequestView | null>(
    null,
  );
  const [form, setForm] = useState<VacationRequestInput>(emptyForm);
  const [durationOpen, setDurationOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const activeStaff = useMemo(
    () => staffOptions.filter((item) => item.status !== "inactive"),
    [staffOptions],
  );

  const visibleVacations = useMemo(
    () => filterVacationsByList(vacations, listFilter),
    [vacations, listFilter],
  );

  function selectSection(next: ReceptionSection) {
    setSection(next);
    setError(null);
    router.replace(`/${org.code}/reception?section=${next}`, { scroll: false });
  }

  function openCreate() {
    setForm(emptyForm);
    setDurationOpen(false);
    setError(null);
    setCreateSuccess(false);
    setCreatedItem(null);
    setEditorOpen(true);
  }

  function closeEditor() {
    if (pending) return;
    setEditorOpen(false);
    setForm(emptyForm);
    setDurationOpen(false);
    setError(null);
    setCreateSuccess(false);
    setCreatedItem(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const created = await createVacationRequestAction(org.code, form);
      setVacations((current) => [
        created,
        ...current.filter((item) => item.id !== created.id),
      ]);
      setListFilter("active");
      setForm(emptyForm);
      setCreatedItem(created);
      setCreateSuccess(true);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not submit vacation request.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-start">
        <aside className="sticky top-12 z-10 flex h-[calc(100dvh-3rem)] w-44 shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white sm:w-56">
          <div className="border-b border-zinc-200 px-3 py-3">
            <p className="truncate font-display text-sm font-semibold text-zinc-900">
              Reception
            </p>
            <p className="mt-0.5 truncate text-xs text-zinc-500">{org.name}</p>
          </div>
          <nav className="flex flex-col gap-0.5 p-2 sm:p-3">
            {RECEPTION_SECTIONS.map((item) => {
              const active = item.key === section;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => selectSection(item.key)}
                  className={[
                    "px-3 py-2 text-left text-sm transition",
                    active
                      ? "bg-header text-header-fg"
                      : "text-zinc-700 hover:bg-zinc-100",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 p-4 sm:p-6">
          {section === "monthly-timesheet" ? (
            <div className="w-full max-w-4xl border border-zinc-300 bg-white">
              <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
                <h2 className="font-display text-base font-semibold text-zinc-900">
                  Monthly Timesheet
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Monthly attendance and hours will be managed here.
                </p>
              </div>
              <div className="px-4 py-5 sm:px-5">
                <p className="text-sm text-zinc-600">
                  Module shell ready. Monthly timesheet functions will be built
                  next.
                </p>
              </div>
            </div>
          ) : null}

          {section === "daily-timesheet-ot" ? (
            <div className="w-full max-w-4xl border border-zinc-300 bg-white">
              <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
                <h2 className="font-display text-base font-semibold text-zinc-900">
                  Daily Timesheet/OT
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Daily timesheets and overtime entries will be managed here.
                </p>
              </div>
              <div className="px-4 py-5 sm:px-5">
                <p className="text-sm text-zinc-600">
                  Module shell ready. Daily timesheet and OT functions will be
                  built next.
                </p>
              </div>
            </div>
          ) : null}

          {section === "visitors" ? (
            <VisitorsPanel
              orgCode={org.code}
              initialVisitors={initialVisitors}
            />
          ) : null}

          {section === "vacation" ? (
            <div className="w-full max-w-4xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-display text-xl font-semibold text-zinc-900">
                    Vacation
                  </h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    Track active leave and send new requests to management.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreate}
                  disabled={activeStaff.length === 0}
                  className="shrink-0 bg-header px-3 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Request a vacation
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setListFilter("active")}
                  className={[
                    "border px-3 py-1.5 text-sm font-medium transition",
                    listFilter === "active"
                      ? "border-header bg-header text-header-fg"
                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setListFilter("completed")}
                  className={[
                    "border px-3 py-1.5 text-sm font-medium transition",
                    listFilter === "completed"
                      ? "border-header bg-header text-header-fg"
                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  Completed vacations
                </button>
                <button
                  type="button"
                  onClick={() => setListFilter("rejected")}
                  className={[
                    "border px-3 py-1.5 text-sm font-medium transition",
                    listFilter === "rejected"
                      ? "border-header bg-header text-header-fg"
                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  Rejected
                </button>
              </div>

              <div className="mt-4 border border-zinc-300 bg-white">
                <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
                  <h3 className="font-display text-base font-semibold text-zinc-900">
                    {FILTER_COPY[listFilter].title}
                  </h3>
                </div>

                {visibleVacations.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-zinc-600 sm:px-5">
                    {FILTER_COPY[listFilter].empty}
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-200">
                    {visibleVacations.map((item) => (
                      <li key={item.id} className="px-4 py-4 sm:px-5">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-900">
                              {item.staffName}
                              {item.staffJobTitle
                                ? ` · ${item.staffJobTitle}`
                                : ""}
                            </p>
                            <p className="mt-1 text-sm text-zinc-600">
                              {leaveTypeLabel(item.leaveType)} ·{" "}
                              {formatVacationDuration(
                                item.selectedDates,
                                item.dayCount,
                                item.startDate,
                                item.endDate,
                              )}
                            </p>
                            {item.reason ? (
                              <p className="mt-1 text-sm text-zinc-600">
                                Reason: {item.reason}
                              </p>
                            ) : null}
                            <p className="mt-1 text-xs text-zinc-500">
                              Created{" "}
                              {formatFriendlyDateTime(new Date(item.createdAt))}
                            </p>
                          </div>
                          <span className="mt-2 shrink-0 text-xs font-medium text-zinc-700 sm:mt-0">
                            {listFilter === "completed"
                              ? "Completed"
                              : vacationStatusLabel(item.status)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {activeStaff.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-600">
                  Add staff members first before requesting vacation.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="vacation-request-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-auto border border-zinc-300 bg-white shadow-lg"
          >
            {createSuccess && createdItem ? (
              <>
                <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
                  <h3
                    id="vacation-request-title"
                    className="font-display text-base font-semibold text-zinc-900"
                  >
                    Request sent
                  </h3>
                </div>
                <div className="px-4 py-5 sm:px-5">
                  <div className="flex items-start gap-3 border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <div>
                      <p>
                        Vacation request for{" "}
                        <span className="font-medium">
                          {createdItem.staffName}
                        </span>{" "}
                        sent to management for approval.
                      </p>
                      <p className="mt-1 text-emerald-800">
                        Status: Awaiting approval ·{" "}
                        {vacationDayCountLabel(createdItem.dayCount)} · Created{" "}
                        {formatFriendlyDateTime(
                          new Date(createdItem.createdAt),
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="bg-header px-3 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={onSubmit}>
                <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
                  <h3
                    id="vacation-request-title"
                    className="font-display text-base font-semibold text-zinc-900"
                  >
                    Request a vacation
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600">
                    Select the employee and leave details, then send to
                    management for approval.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Duration
                    </span>
                    <button
                      type="button"
                      onClick={() => setDurationOpen((open) => !open)}
                      className="flex items-center justify-between border border-zinc-300 bg-white px-3 py-2 text-left text-sm outline-none transition hover:bg-zinc-50 focus:border-header"
                    >
                      <span
                        className={
                          form.selectedDates.length > 0
                            ? "text-zinc-900"
                            : "text-zinc-500"
                        }
                      >
                        {form.selectedDates.length > 0
                          ? formatVacationDuration(
                              form.selectedDates,
                              form.selectedDates.length,
                              form.selectedDates[0] ?? "",
                              form.selectedDates[
                                form.selectedDates.length - 1
                              ] ?? "",
                            )
                          : "Select duration"}
                      </span>
                      <span className="text-xs font-medium text-zinc-500">
                        {durationOpen ? "Hide calendar" : "Open calendar"}
                      </span>
                    </button>
                    {durationOpen ? (
                      <div className="mt-2">
                        <DurationCalendar
                          selectedDates={form.selectedDates}
                          onChange={(selectedDates) =>
                            setForm((current) => ({
                              ...current,
                              selectedDates,
                            }))
                          }
                        />
                      </div>
                    ) : null}
                  </div>

                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Employee
                    </span>
                    <select
                      required
                      value={form.staffId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          staffId: event.target.value,
                        }))
                      }
                      className="border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-header"
                    >
                      <option value="">Select employee</option>
                      {activeStaff.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.fullName}
                          {item.jobTitle ? ` · ${item.jobTitle}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[12px] font-medium text-zinc-700">
                      Leave type
                    </span>
                    <select
                      value={form.leaveType}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          leaveType: event.target.value as LeaveType,
                          reason:
                            event.target.value === "other"
                              ? current.reason
                              : "",
                        }))
                      }
                      className="border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-header"
                    >
                      {LEAVE_TYPES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {form.leaveType === "other" ? (
                    <label className="flex flex-col gap-1.5 sm:col-span-2">
                      <span className="text-[12px] font-medium text-zinc-700">
                        Reason
                      </span>
                      <textarea
                        required
                        value={form.reason}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            reason: event.target.value,
                          }))
                        }
                        rows={3}
                        placeholder="Enter the reason for this leave"
                        className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                      />
                    </label>
                  ) : null}
                </div>

                {error ? (
                  <div className="border-t border-zinc-200 px-4 py-3 text-sm text-red-700 sm:px-5">
                    {error}
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={closeEditor}
                    disabled={pending}
                    className="border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-45"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      pending ||
                      activeStaff.length === 0 ||
                      form.selectedDates.length === 0
                    }
                    className="bg-header px-3 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {pending ? "Sending…" : "Send to management for approval"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
