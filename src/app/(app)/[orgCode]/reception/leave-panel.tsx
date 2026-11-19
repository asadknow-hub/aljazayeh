"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PlusIcon } from "@/components/ui/icons";
import { formatLeavePeriod } from "@/lib/datetime/format";
import type { StaffOption } from "@/lib/staff/types";
import {
  filterVacationsByList,
  leaveTypeLabel,
  vacationStatusLabel,
  type VacationListFilter,
  type VacationRequestView,
} from "@/lib/vacation/types";

const FILTERS: { key: VacationListFilter; label: string; empty: string }[] = [
  { key: "active", label: "Active", empty: "No active leave right now." },
  { key: "completed", label: "Completed", empty: "No completed leave yet." },
  { key: "rejected", label: "Rejected", empty: "No rejected requests." },
];

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
  const [filter, setFilter] = useState<VacationListFilter>("active");

  const visible = useMemo(
    () => filterVacationsByList(requests, filter, today),
    [requests, filter, today],
  );
  const hasStaff = staffOptions.some((item) => item.status === "active");

  return (
    <div className="w-full max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Vacation
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Raise a leave request for an employee and follow its approval.
          </p>
        </div>
        {hasStaff ? (
          <Link href={`/${orgCode}/leave/new`} className="btn btn-primary">
            <PlusIcon />
            New leave request
          </Link>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={[
              "border px-3 py-1.5 text-sm font-medium transition rounded-lg",
              filter === item.key
                ? "border-primary bg-primary text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="card mt-4">
        {visible.length === 0 ? (
          <p className="px-4 py-5 text-sm text-slate-600 sm:px-5">
            {FILTERS.find((item) => item.key === filter)!.empty}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {visible.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/${orgCode}/leave/${item.id}`}
                  className="flex flex-col gap-1 px-4 py-3 transition hover:bg-slate-50 sm:flex-row sm:items-start sm:justify-between sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">
                      {item.staffName}
                      {item.staffJobTitle ? ` · ${item.staffJobTitle}` : ""}
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-600">
                      {leaveTypeLabel(item.leaveType)} ·{" "}
                      {formatLeavePeriod(
                        item.startDate,
                        item.endDate,
                        item.dayCount,
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-slate-700">
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

      {!hasStaff ? (
        <p className="mt-4 text-sm text-slate-600">
          Add staff members first before raising a leave request.
        </p>
      ) : null}
    </div>
  );
}
