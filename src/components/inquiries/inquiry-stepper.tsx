"use client";

import { useState } from "react";
import { DepartmentChip } from "@/components/inquiries/inquiry-chips";
import { CheckIcon, LockIcon, UserIcon } from "@/components/ui/icons";
import type {
  InquiryStageKey,
  InquiryWorkflowDepartmentKey,
} from "@/lib/inquiries/stages";
import type { AssignableStaff, InquiryStepView } from "@/lib/inquiries/types";

/**
 * The steps of the process, top to bottom, each with its own person: who
 * handled a finished step, who is on the current one, and who a step still
 * to come is planned for. Finished steps and the current one can be opened;
 * steps the inquiry has not reached are locked, but can be planned.
 */
export function InquiryStepper({
  steps,
  viewing,
  assignable,
  pending,
  onSelect,
  onPlan,
}: {
  steps: InquiryStepView[];
  viewing: InquiryStageKey;
  /** The staff of each department the signed-in person may assign in. */
  assignable: Partial<Record<InquiryWorkflowDepartmentKey, AssignableStaff[]>>;
  pending: boolean;
  onSelect: (key: InquiryStageKey) => void;
  /** Plan an upcoming step for a person; an empty id takes the plan back. */
  onPlan: (key: InquiryStageKey, staffId: string) => void;
}) {
  const [planning, setPlanning] = useState<InquiryStageKey | null>(null);

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
                      {step.handlerName ?? (
                        <span className="text-accent">nobody assigned</span>
                      )}
                    </span>
                  ) : step.state === "done" && step.handlerName ? (
                    <span className="mt-1 block text-xs font-medium text-slate-600">
                      Handled by {step.handlerName}
                    </span>
                  ) : null}
                  {!locked && step.documentNumber ? (
                    <span className="mt-1 block truncate text-xs font-medium text-slate-600 tabular-nums">
                      {step.documentNumber}
                    </span>
                  ) : null}
                </span>
              </button>

              {/* Who a step still to come is planned for. Kept outside the
                  locked row, so it stays readable. */}
              {locked && (step.handlerName || step.canPlan) ? (
                <div className="mt-0.5 mb-1 ml-[3.125rem] flex flex-wrap items-center gap-1.5 text-xs">
                  {planning === step.key ? (
                    <select
                      autoFocus
                      aria-label={`Who will handle ${step.label}`}
                      value={step.handlerStaffId ?? ""}
                      disabled={pending}
                      onBlur={() => setPlanning(null)}
                      onChange={(event) => {
                        onPlan(step.key, event.target.value);
                        setPlanning(null);
                      }}
                      className="field !py-1 text-xs"
                    >
                      <option value="">Nobody yet</option>
                      {(assignable[step.departmentKey] ?? []).map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.fullName}
                          {staff.jobTitle ? ` · ${staff.jobTitle}` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <>
                      {step.handlerName ? (
                        <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                          <UserIcon className="h-3.5 w-3.5" />
                          Planned for {step.handlerName}
                        </span>
                      ) : null}
                      {step.canPlan ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setPlanning(step.key)}
                          className="cursor-pointer font-medium text-primary hover:underline"
                        >
                          {step.handlerName ? "Change" : "Plan who handles it"}
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
