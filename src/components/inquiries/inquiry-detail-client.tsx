"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  DepartmentChip,
  StatusChip,
} from "@/components/inquiries/inquiry-chips";
import {
  InquirySidePanel,
  type InquirySideActions,
} from "@/components/inquiries/inquiry-side-panel";
import { InquiryStepper } from "@/components/inquiries/inquiry-stepper";
import {
  StageAnswers,
  StageFields,
  StageItems,
} from "@/components/inquiries/stage-form";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { useToast } from "@/components/providers/toast-provider";
import {
  AlertIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  DocumentIcon,
  LockIcon,
} from "@/components/ui/icons";
import type { ActionResult } from "@/lib/actions/result";
import { unwrap } from "@/lib/actions/result";
import {
  appDateValue,
  formatFriendlyDate,
  formatFriendlyDateTime,
} from "@/lib/datetime/format";
import {
  addInquiryCommentAction,
  approveInquiryStageAction,
  assignInquiryAction,
  closeInquiryAction,
  reopenInquiryAction,
  saveInquiryStageAction,
  sendInquiryBackAction,
} from "@/lib/inquiries/actions";
import {
  INQUIRY_APPROVAL_ROLES,
  workflowDepartmentLabel,
  type InquiryStageKey,
  type InquiryWorkflowDepartmentKey,
} from "@/lib/inquiries/stages";
import {
  formatMoney,
  inquiryTotals,
  STAGE_DEFINITIONS,
} from "@/lib/inquiries/stage-forms";
import type {
  AssignableStaff,
  InquiryStageInput,
  InquiryView,
} from "@/lib/inquiries/types";

type InquiryDetailClientProps = {
  orgCode: string;
  initialInquiry: InquiryView;
  backHref: string;
  myStaffId: string;
  /** People who can be given work, per department the viewer may assign in. */
  assignable: Partial<Record<InquiryWorkflowDepartmentKey, AssignableStaff[]>>;
};

/** Changes whenever anything shown on the page has changed. */
function versionOf(inquiry: InquiryView): string {
  return [
    inquiry.updatedAt,
    inquiry.status,
    inquiry.assignedStaffId,
    inquiry.currentStageApproved,
    inquiry.comments.length,
    inquiry.activityLogs.length,
  ].join("|");
}

/** The current step may be filled in by the signed-in person right now. */
function canEdit(inquiry: InquiryView): boolean {
  return (
    inquiry.status === "open" &&
    inquiry.canWork &&
    inquiry.assignedStaffId !== null
  );
}

/**
 * What the form of the current step starts with: what is saved, plus the
 * values a step offers the first time it is opened (today's date, the job's
 * total, everything delivered in full).
 */
function draftOf(inquiry: InquiryView): InquiryStageInput {
  const step = inquiry.steps.find((item) => item.key === inquiry.currentStage);
  const definition = STAGE_DEFINITIONS[inquiry.currentStage];
  const editable = canEdit(inquiry);
  const fields = { ...(step?.fields ?? {}) };

  if (editable) {
    for (const field of definition.fields) {
      if (fields[field.key] || !field.prefill) continue;
      fields[field.key] =
        field.prefill === "today"
          ? appDateValue()
          : field.prefill === "grandTotal"
            ? inquiry.totals.total > 0
              ? inquiry.totals.total.toFixed(2)
              : ""
            : field.prefill;
    }
  }

  return {
    fields,
    lineItems: inquiry.lineItems.map((item) => ({
      ...item,
      deliveredQuantity:
        editable && definition.items === "delivery" && !item.deliveredQuantity
          ? item.quantity
          : item.deliveredQuantity,
    })),
  };
}

export function InquiryDetailClient({
  orgCode,
  initialInquiry,
  backHref,
  myStaffId,
  assignable,
}: InquiryDetailClientProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [inquiry, setInquiry] = useState(initialInquiry);
  const [saved, setSaved] = useState(() => draftOf(initialInquiry));
  const [draft, setDraft] = useState(saved);
  const [viewing, setViewing] = useState<InquiryStageKey>(
    initialInquiry.currentStage,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  usePageTitle(inquiry.number || inquiry.customerName);

  /** Show a fresh copy of the inquiry and start its form from what is saved. */
  function show(next: InquiryView) {
    const nextDraft = draftOf(next);
    setInquiry(next);
    setSaved(nextDraft);
    setDraft(nextDraft);
    setViewing(next.currentStage);
  }

  // A newer copy from the server replaces what is on screen. A copy that
  // says nothing new is ignored, so it cannot wipe what is being typed.
  const [seenInitial, setSeenInitial] = useState(initialInquiry);
  if (seenInitial !== initialInquiry) {
    setSeenInitial(initialInquiry);
    if (versionOf(initialInquiry) !== versionOf(inquiry)) show(initialInquiry);
  }

  /** Run a change; returns the updated inquiry, or null if it was refused. */
  async function run(
    work: () => Promise<ActionResult<InquiryView>>,
  ): Promise<InquiryView | null> {
    if (pending) return null;
    setError(null);
    setPending(true);
    try {
      const updated = await unwrap(work());
      show(updated);
      router.refresh();
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return null;
    } finally {
      setPending(false);
    }
  }

  const currentStep = inquiry.steps.find(
    (step) => step.key === inquiry.currentStage,
  )!;
  const nextStep = inquiry.steps[currentStep.number];
  const viewedStep =
    inquiry.steps.find((step) => step.key === viewing) ?? currentStep;
  const definition = STAGE_DEFINITIONS[viewedStep.key];
  const viewingCurrent = viewedStep.key === inquiry.currentStage;
  const editable = viewingCurrent && canEdit(inquiry);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const approver =
    INQUIRY_APPROVAL_ROLES.find(
      (role) => role.key === currentStep.approvalRequiredBy,
    )?.label ?? "";
  const waitingForApproval =
    currentStep.approvalRequired && !inquiry.currentStageApproved;
  // Prices typed on the quotation show in the totals straight away.
  const totals =
    editable && definition.items === "priced"
      ? inquiryTotals(draft.lineItems, draft.fields)
      : inquiry.totals;

  async function save(complete: boolean) {
    const updated = await run(() =>
      saveInquiryStageAction(orgCode, inquiry.id, draft, complete),
    );
    if (!updated) return;
    if (!complete) {
      showToast("Saved");
    } else if (updated.status === "completed") {
      showToast("Inquiry completed");
    } else {
      showToast(
        `Sent to ${workflowDepartmentLabel(updated.owningDepartmentKey)}`,
      );
      // It has left this person's hands; go back to their list.
      if (!updated.canWork && !updated.canAssign) router.push(backHref);
    }
  }

  const sideActions: InquirySideActions = {
    assign: async (staffId) => {
      if (await run(() => assignInquiryAction(orgCode, inquiry.id, staffId))) {
        showToast("Assigned");
      }
    },
    approve: async () => {
      if (await run(() => approveInquiryStageAction(orgCode, inquiry.id))) {
        showToast("Step approved");
      }
    },
    addNote: async (body) =>
      Boolean(
        await run(() => addInquiryCommentAction(orgCode, inquiry.id, body)),
      ),
    sendBack: async (reason) => {
      const updated = await run(() =>
        sendInquiryBackAction(orgCode, inquiry.id, reason),
      );
      if (!updated) return false;
      showToast(
        `Sent back to ${workflowDepartmentLabel(updated.owningDepartmentKey)}`,
      );
      if (!updated.canWork && !updated.canAssign) router.push(backHref);
      return true;
    },
    close: async (reason) =>
      Boolean(await run(() => closeInquiryAction(orgCode, inquiry.id, reason))),
    reopen: async () => {
      if (await run(() => reopenInquiryAction(orgCode, inquiry.id))) {
        showToast("Inquiry reopened");
      }
    },
  };

  const references = inquiry.steps.flatMap((step) => {
    if (step.state === "locked") return [];
    const number =
      step.key === "lpo_in_or_out"
        ? (step.fields.customerLpoNumber ?? "")
        : step.documentNumber;
    return number && step.key !== "inquiry"
      ? [{ key: step.key, label: STAGE_DEFINITIONS[step.key].documentLabel, number }]
      : [];
  });

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-primary"
      >
        <ArrowLeftIcon />
        Back to inquiries
      </Link>

      <header className="card flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip bg-slate-900 text-white">
                {inquiry.number}
              </span>
              <StatusChip status={inquiry.status} />
              {inquiry.jobType === "export" ? (
                <span className="chip bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200 ring-inset">
                  Export job
                </span>
              ) : null}
              {inquiry.overdue ? (
                <span className="chip bg-red-50 text-red-700 ring-1 ring-red-200 ring-inset">
                  <AlertIcon className="h-3 w-3" />
                  Past the date needed
                </span>
              ) : null}
            </div>
            <h2 className="mt-2 font-display text-xl font-semibold text-slate-900">
              {inquiry.title || "Untitled inquiry"}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {inquiry.customerName}
              {inquiry.contact ? ` · ${inquiry.contact}` : ""}
              {inquiry.deliveryExpectedOn
                ? ` · Needed by ${formatFriendlyDate(inquiry.deliveryExpectedOn)}`
                : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-slate-500">Job value</p>
            <p className="font-display text-xl font-semibold text-slate-900 tabular-nums">
              AED {formatMoney(inquiry.totals.total)}
            </p>
            {inquiry.status === "open" ? (
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
                <ClockIcon className="h-3.5 w-3.5" />
                {inquiry.daysInStage === 0
                  ? "At this step since today"
                  : `At this step for ${inquiry.daysInStage} day${inquiry.daysInStage === 1 ? "" : "s"}`}
              </p>
            ) : null}
          </div>
        </div>
        {references.length > 0 ? (
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
            {references.map((reference) => (
              <span key={reference.key} className="inline-flex items-center gap-1">
                <DocumentIcon className="h-3.5 w-3.5 text-slate-400" />
                {reference.label}{" "}
                <span className="font-medium text-slate-900">
                  {reference.number}
                </span>
              </span>
            ))}
          </div>
        ) : null}
        {inquiry.status === "cancelled" ? (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
            Closed as lost: {inquiry.closeReason}
          </p>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-start">
        <div className="w-full shrink-0 lg:w-64">
          <InquiryStepper
            steps={inquiry.steps}
            viewing={viewedStep.key}
            assignedStaffName={inquiry.assignedStaffName}
            onSelect={setViewing}
          />
        </div>

        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void save(false);
          }}
          className="card min-w-0 flex-1"
        >
          <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Step {viewedStep.number} of {inquiry.steps.length}
              </span>
              <DepartmentChip department={viewedStep.departmentKey} />
              {viewedStep.documentNumber && viewedStep.key !== "inquiry" ? (
                <span className="chip bg-slate-100 text-slate-700">
                  {viewedStep.documentNumber}
                </span>
              ) : null}
            </div>
            <h3 className="mt-1.5 font-display text-lg font-semibold text-slate-900">
              {viewedStep.label}
            </h3>
            <p className="mt-0.5 text-sm text-slate-600">{definition.purpose}</p>
          </div>

          {viewedStep.state === "done" ? (
            <p className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 sm:px-5">
              <CheckIcon className="h-4 w-4 text-emerald-600" />
              Done
              {viewedStep.completedByName
                ? ` by ${viewedStep.completedByName}`
                : ""}
              {viewedStep.completedAt
                ? ` · ${formatFriendlyDateTime(new Date(viewedStep.completedAt))}`
                : ""}
            </p>
          ) : null}
          {viewingCurrent && inquiry.status === "open" && !editable ? (
            <p className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:px-5">
              <LockIcon className="h-4 w-4 text-amber-600" />
              {inquiry.canWork
                ? "Assign someone on the right to start working on this step."
                : `View only. This step is handled by ${workflowDepartmentLabel(inquiry.owningDepartmentKey)}.`}
            </p>
          ) : null}

          <div className="flex flex-col gap-6 px-4 py-5 sm:px-5">
            {editable ? (
              <StageFields
                stage={viewedStep.key}
                values={draft.fields}
                disabled={pending}
                onChange={(fields) => setDraft({ ...draft, fields })}
              />
            ) : (
              <StageAnswers
                stage={viewedStep.key}
                values={viewingCurrent ? draft.fields : viewedStep.fields}
              />
            )}
            <StageItems
              mode={definition.items}
              items={draft.lineItems}
              totals={totals}
              disabled={!editable || pending}
              onChange={(lineItems) => setDraft({ ...draft, lineItems })}
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:px-5"
            >
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}

          {editable ? (
            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:px-5">
              {waitingForApproval ? (
                <p className="text-sm text-amber-800">
                  This step needs approval by {approver} before it can move on.
                  Save it so they can check it.
                </p>
              ) : currentStep.approvalRequired && dirty ? (
                <p className="text-sm text-amber-800">
                  You changed a step that was already approved. Save it and ask{" "}
                  {approver} to approve it again.
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={pending || !dirty}
                  onClick={() => {
                    setDraft(saved);
                    setError(null);
                  }}
                  className="btn btn-secondary"
                >
                  Discard
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={pending || !dirty}
                    className="btn btn-secondary"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    disabled={
                      pending ||
                      waitingForApproval ||
                      (currentStep.approvalRequired && dirty)
                    }
                    onClick={() => void save(true)}
                    className="btn btn-go !items-center !py-1.5 text-left"
                  >
                    <span className="flex flex-col leading-tight">
                      <span>
                        {nextStep
                          ? "Save & Go to Next Step"
                          : "Save & Complete Inquiry"}
                      </span>
                      <span className="text-xs font-normal text-emerald-50">
                        {nextStep
                          ? `Goes to ${workflowDepartmentLabel(nextStep.departmentKey)} · ${nextStep.number}. ${nextStep.label}`
                          : "The job is paid and closed"}
                      </span>
                    </span>
                    <ArrowRightIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </form>

        <InquirySidePanel
          key={`${inquiry.currentStage}-${inquiry.status}`}
          inquiry={inquiry}
          staffOptions={assignable[inquiry.owningDepartmentKey] ?? []}
          myStaffId={myStaffId}
          pending={pending}
          actions={sideActions}
        />
      </div>
    </main>
  );
}
