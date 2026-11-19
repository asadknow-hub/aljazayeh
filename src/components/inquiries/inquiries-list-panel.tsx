"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  DepartmentChip,
  StatusChip,
} from "@/components/inquiries/inquiry-chips";
import { NewInquiryDialog } from "@/components/inquiries/new-inquiry-dialog";
import { useToast } from "@/components/providers/toast-provider";
import { AlertIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { unwrap } from "@/lib/actions/result";
import { formatFriendlyDate } from "@/lib/datetime/format";
import { assignInquiryAction } from "@/lib/inquiries/actions";
import {
  INQUIRY_STAGES,
  inquiryStageLabel,
  isExportOnlyStage,
  stageNumber,
  type InquiryStageKey,
  type InquiryWorkflowDepartmentKey,
} from "@/lib/inquiries/stages";
import { formatMoney } from "@/lib/inquiries/stage-forms";
import type {
  AssignableStaff,
  InquiryStatus,
  InquirySummary,
} from "@/lib/inquiries/types";
import { useServerState } from "@/lib/react/use-server-state";

type InquiriesListPanelProps = {
  orgCode: string;
  initialInquiries: InquirySummary[];
  /** Where an inquiry opens; the department is the one that handles it. */
  detailHref: (inquiry: InquirySummary) => string;
  description: string;
  allowCreate: boolean;
  myStaffId: string;
  assignable: Partial<Record<InquiryWorkflowDepartmentKey, AssignableStaff[]>>;
};

type Who = "all" | "mine" | "unassigned";

const WHO_FILTERS: { key: Who; label: string }[] = [
  { key: "all", label: "Everyone's" },
  { key: "mine", label: "Mine" },
  { key: "unassigned", label: "Not assigned" },
];

const STATUS_FILTERS: { key: InquiryStatus; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Lost" },
];

export function InquiriesListPanel({
  orgCode,
  initialInquiries,
  detailHref,
  description,
  allowCreate,
  myStaffId,
  assignable,
}: InquiriesListPanelProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [items, setItems] = useServerState(initialInquiries);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InquiryStatus>("open");
  const [who, setWho] = useState<Who>("all");
  const [stage, setStage] = useState<InquiryStageKey | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);

  const open = useMemo(
    () => items.filter((item) => item.status === "open"),
    [items],
  );
  const countByStage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of open) {
      counts.set(item.currentStage, (counts.get(item.currentStage) ?? 0) + 1);
    }
    return counts;
  }, [open]);

  const shown = useMemo(() => {
    const words = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        item.status === status &&
        (status !== "open" || !stage || item.currentStage === stage) &&
        (who === "all" ||
          (who === "mine" && item.assignedStaffId === myStaffId) ||
          (who === "unassigned" && !item.assignedStaffId)) &&
        (!words ||
          [item.number, item.title, item.customerName, item.contact]
            .join(" ")
            .toLowerCase()
            .includes(words)),
    );
  }, [items, search, status, stage, who, myStaffId]);

  async function assign(inquiry: InquirySummary, staffId: string) {
    if (!staffId || assigning) return;
    setAssigning(inquiry.id);
    try {
      const updated = await unwrap(
        assignInquiryAction(orgCode, inquiry.id, staffId),
      );
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      showToast(`Assigned to ${updated.assignedStaffName}`);
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not assign.");
    } finally {
      setAssigning(null);
    }
  }

  const segment = (active: boolean) =>
    [
      "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
      active
        ? "bg-white text-slate-900 shadow-sm"
        : "text-slate-600 hover:text-slate-900",
    ].join(" ");

  return (
    <div className="w-full max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Inquiries
          </h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        {allowCreate ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="btn btn-primary shrink-0"
          >
            <PlusIcon />
            New inquiry
          </button>
        ) : null}
      </div>

      {/* How many open inquiries sit at each step; click one to see them. */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-10">
        {INQUIRY_STAGES.map((item) => {
          const count = countByStage.get(item.key) ?? 0;
          const active = status === "open" && stage === item.key;
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setStatus("open");
                setStage(active ? null : item.key);
              }}
              className={[
                "card cursor-pointer px-2.5 py-2 text-left transition-colors hover:border-blue-300",
                active ? "!border-primary !bg-primary-soft" : "",
              ].join(" ")}
            >
              <span className="block text-[11px] leading-tight font-medium text-slate-500">
                {isExportOnlyStage(item.key)
                  ? `${item.label} (export)`
                  : `${stageNumber(item.key, "local")}. ${item.label}`}
              </span>
              <span
                className={[
                  "mt-1 block font-display text-xl font-semibold tabular-nums",
                  count > 0 ? "text-slate-900" : "text-slate-300",
                ].join(" ")}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search inquiries</span>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by number, title or customer"
            className="field w-full !pl-9"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-wrap rounded-lg bg-slate-200/70 p-1">
            {WHO_FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={who === item.key}
                onClick={() => setWho(item.key)}
                className={segment(who === item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap rounded-lg bg-slate-200/70 p-1">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={status === item.key}
                onClick={() => setStatus(item.key)}
                className={segment(status === item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card mt-3 overflow-x-auto">
        {shown.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            {items.length === 0
              ? "No inquiries yet."
              : "No inquiries match what you picked above."}
          </p>
        ) : (
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Inquiry</th>
                <th className="px-3 py-2.5">Step</th>
                <th className="px-3 py-2.5">Handled by</th>
                <th className="px-3 py-2.5 text-right">Value (AED)</th>
                <th className="px-4 py-2.5">Needed by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((item) => {
                const staff = assignable[item.owningDepartmentKey] ?? [];
                return (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={detailHref(item)}
                        className="group block min-w-0"
                      >
                        <span className="block text-xs font-medium text-slate-500">
                          {item.number}
                        </span>
                        <span className="block truncate font-medium text-slate-900 group-hover:text-primary">
                          {item.title || item.customerName}
                        </span>
                        {item.title ? (
                          <span className="block truncate text-xs text-slate-600">
                            {item.customerName}
                          </span>
                        ) : null}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {item.status === "open" ? (
                        <>
                          <span className="block font-medium text-slate-900">
                            {stageNumber(item.currentStage, item.jobType)}.{" "}
                            {inquiryStageLabel(item.currentStage)}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            <DepartmentChip
                              department={item.owningDepartmentKey}
                            />
                            {item.daysInStage >= 3 ? (
                              <span className="text-xs text-amber-700">
                                {item.daysInStage} days here
                              </span>
                            ) : null}
                          </span>
                        </>
                      ) : (
                        <StatusChip status={item.status} />
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {item.assignedStaffName ? (
                        <span className="text-slate-900">
                          {item.assignedStaffName}
                        </span>
                      ) : item.status !== "open" ? (
                        <span className="text-slate-400">—</span>
                      ) : item.canAssign && staff.length > 0 ? (
                        <select
                          aria-label={`Assign ${item.number}`}
                          value=""
                          disabled={assigning === item.id}
                          onChange={(event) => assign(item, event.target.value)}
                          className="field !w-40 !border-orange-300 !bg-accent-soft !py-1 !text-accent"
                        >
                          <option value="">Assign to…</option>
                          {staff.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.fullName}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="chip bg-accent-soft text-accent ring-1 ring-orange-200 ring-inset">
                          Not assigned
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-900">
                      {item.totals.total > 0
                        ? formatMoney(item.totals.total)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {item.deliveryExpectedOn ? (
                        <span
                          className={
                            item.overdue
                              ? "inline-flex items-center gap-1 font-medium text-red-700"
                              : "text-slate-700"
                          }
                        >
                          {item.overdue ? (
                            <AlertIcon className="h-3.5 w-3.5" />
                          ) : null}
                          {formatFriendlyDate(item.deliveryExpectedOn)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {creating ? (
        <NewInquiryDialog
          orgCode={orgCode}
          onClose={() => setCreating(false)}
          onCreated={(inquiry) => {
            // Closed first: this list stays alive behind the next page, and
            // coming back must not find the dialog still saving.
            setCreating(false);
            showToast(`${inquiry.number} created`);
            router.push(detailHref(inquiry));
          }}
        />
      ) : null}
    </div>
  );
}
