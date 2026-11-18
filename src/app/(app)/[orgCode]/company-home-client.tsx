"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DepartmentIcon } from "@/components/departments/department-icons";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { useToast } from "@/components/providers/toast-provider";
import {
  formatFriendlyDateTime,
  formatVacationDuration,
} from "@/lib/datetime/format";
import {
  DEPARTMENTS,
  departmentPath,
} from "@/lib/departments/catalog";
import {
  approveVacationRequestAction,
  rejectVacationRequestAction,
} from "@/lib/vacation/actions";
import {
  leaveTypeLabel,
  type VacationRequestView,
} from "@/lib/vacation/types";

type CompanyHomeClientProps = {
  org: {
    id: string;
    name: string;
    code: string;
  };
  pendingVacations: VacationRequestView[];
};

export function CompanyHomeClient({
  org,
  pendingVacations,
}: CompanyHomeClientProps) {
  usePageTitle("Select Department");
  const router = useRouter();
  const { showToast } = useToast();
  const [items, setItems] = useState(pendingVacations);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(pendingVacations);
  }, [pendingVacations]);

  async function onApprove(id: string) {
    setError(null);
    setBusyId(id);
    try {
      await approveVacationRequestAction(org.code, id);
      setItems((current) => current.filter((item) => item.id !== id));
      showToast("Vacation approved");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve.");
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(id: string) {
    setError(null);
    setBusyId(id);
    try {
      await rejectVacationRequestAction(org.code, id);
      setItems((current) => current.filter((item) => item.id !== id));
      showToast("Vacation rejected");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="flex flex-1 flex-col px-4 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {DEPARTMENTS.map((dept) => (
          <Link
            key={dept.key}
            href={departmentPath(org.code, dept.slug)}
            className="group flex flex-col items-center gap-3 text-center outline-none"
          >
            <span className="flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-2xl bg-white shadow-[0_2px_10px_rgba(24,24,27,0.08)] ring-1 ring-zinc-200/80 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_8px_20px_rgba(24,24,27,0.12)] group-hover:ring-zinc-300 group-focus-visible:ring-2 group-focus-visible:ring-header sm:h-24 sm:w-24">
              <DepartmentIcon
                departmentKey={dept.key}
                accent={dept.accent}
                className="h-12 w-12 transition duration-200 group-hover:scale-105 sm:h-14 sm:w-14"
              />
            </span>
            <span className="max-w-[9.5rem] font-display text-[15px] font-semibold leading-snug text-zinc-800 transition group-hover:text-zinc-950 sm:text-base">
              {dept.label}
            </span>
          </Link>
        ))}
      </div>

      <section className="mx-auto mt-12 w-full max-w-5xl">
        <div className="border border-zinc-300 bg-white">
          <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
            <h2 className="font-display text-base font-semibold text-zinc-900">
              My Tasks
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Vacation requests awaiting management approval.
            </p>
          </div>

          {error ? (
            <div className="border-b border-zinc-200 px-4 py-3 text-sm text-red-700 sm:px-5">
              {error}
            </div>
          ) : null}

          {items.length === 0 ? (
            <p className="px-4 py-5 text-sm text-zinc-600 sm:px-5">
              No pending tasks right now.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {items.map((item) => {
                const busy = busyId === item.id;
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900">
                        Vacation request · {item.staffName}
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
                        Requested {formatFriendlyDateTime(new Date(item.createdAt))}
                        {item.staffJobTitle ? ` · ${item.staffJobTitle}` : ""}
                      </p>
                      <Link
                        href={`/${org.code}/staff/${item.staffId}?section=vacation`}
                        className="mt-2 inline-block text-xs font-medium text-header underline-offset-2 hover:underline"
                      >
                        Open staff vacation log
                      </Link>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onReject(item.id)}
                        className="border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-45"
                      >
                        {busy ? "…" : "Reject"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onApprove(item.id)}
                        className="bg-header px-3 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control disabled:opacity-45"
                      >
                        {busy ? "…" : "Approve"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
