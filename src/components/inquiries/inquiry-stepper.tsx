"use client";

import { DepartmentChip } from "@/components/inquiries/inquiry-chips";
import { CheckIcon, LockIcon } from "@/components/ui/icons";
import type { InquiryStageKey } from "@/lib/inquiries/stages";
import type { InquiryStepView } from "@/lib/inquiries/types";

/**
 * The steps of the process, top to bottom. Finished steps and the current
 * one can be opened; steps the inquiry has not reached are locked.
 */
export function InquiryStepper({
  steps,
  viewing,
  assignedStaffName,
  onSelect,
}: {
  steps: InquiryStepView[];
  viewing: InquiryStageKey;
  assignedStaffName: string | null;
  onSelect: (key: InquiryStageKey) => void;
}) {
  return (
    <nav aria-label="Steps of this inquiry" className="card p-2">
      <ol className="flex flex-col gap-1">
        {steps.map((step) => {
          const locked = step.state === "locked";
          const selected = step.key === viewing;
          return (
            <li key={step.key}>
              <button
                type="button"
                disabled={locked}
                aria-current={selected ? "step" : undefined}
                title={locked ? "Not reached yet" : undefined}
                onClick={() => onSelect(step.key)}
                className={[
                  "flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                  locked
                    ? "cursor-not-allowed opacity-45 blur-[1.2px] select-none"
                    : "cursor-pointer hover:bg-slate-50",
                  selected ? "bg-primary-soft ring-1 ring-blue-200" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    step.state === "done"
                      ? "bg-emerald-500 text-white"
                      : step.state === "current"
                        ? "bg-primary text-white ring-4 ring-blue-100"
                        : "bg-slate-200 text-slate-600",
                  ].join(" ")}
                >
                  {step.state === "done" ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    step.number
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    <span className="truncate">
                      {step.number}. {step.label}
                    </span>
                    {locked ? (
                      <LockIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    ) : null}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <DepartmentChip department={step.departmentKey} />
                  </span>
                  {step.state === "current" ? (
                    <span className="mt-1 block text-xs font-medium text-blue-700">
                      In progress ·{" "}
                      {assignedStaffName ?? (
                        <span className="text-accent">nobody assigned</span>
                      )}
                    </span>
                  ) : null}
                  {step.state === "done" && step.documentNumber ? (
                    <span className="mt-1 block truncate text-xs text-slate-500">
                      {step.documentNumber}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
