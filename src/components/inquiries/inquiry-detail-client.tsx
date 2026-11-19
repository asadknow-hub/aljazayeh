"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  DepartmentChip,
  StatusChip,
} from "@/components/inquiries/inquiry-chips";
import {
  ApprovalBanner,
  HandlingBlock,
  InquiryExtras,
  type InquirySideActions,
} from "@/components/inquiries/inquiry-side-panel";
import { InquiryStepper } from "@/components/inquiries/inquiry-stepper";
import { PaperProvider } from "@/components/inquiries/paper";
import { StagePaper } from "@/components/inquiries/papers";
import {
  fillId,
  hasFields,
  InquiryItems,
  itemFillKey,
  ItemsEditor,
  StageAnswers,
  StageFields,
  TablesEditor,
} from "@/components/inquiries/stage-form";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { useToast } from "@/components/providers/toast-provider";
import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  DocumentIcon,
  LockIcon,
  PrinterIcon,
} from "@/components/ui/icons";
import type { CompanyLetterhead } from "@/lib/company-settings/types";
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
  reopenInquiryStepAction,
  requestInquiryApprovalAction,
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
  documentsInUse,
  formatMoney,
  inquiryTotals,
  mainDocument,
  missingStageFields,
  STAGE_DEFINITIONS,
  STEP_FORM,
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
  /** The company's own details, printed on its papers. */
  company: CompanyLetterhead;
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
    inquiry.approvalRequested,
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
 * What the current step starts with: what is saved, plus the values a step
 * offers the first time it is opened (today's date, the job's total, the
 * customer's name, everything delivered in full).
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
            : field.prefill === "neededBy"
              ? inquiry.deliveryExpectedOn
              : field.prefill === "customerName"
                ? inquiry.customerName
                : field.prefill === "customerAddress"
                  ? (inquiry.steps[0]?.fields.customerAddress ?? "")
                  : field.prefill;
    }
  }

  return {
    fields,
    tables: step?.tables ?? {},
    lineItems: inquiry.lineItems.map((item) => ({
      ...item,
      deliveredQuantity:
        editable && definition.items === "delivery" && !item.deliveredQuantity
          ? item.quantity
          : item.deliveredQuantity,
    })),
  };
}

/**
 * What still has to be written before the current step can be completed, as
 * the keys of the places to write it. The server checks the same things.
 */
function missingFrom(
  stage: InquiryStageKey,
  draft: InquiryStageInput,
): { key: string; on: string }[] {
  const missing = missingStageFields(stage, draft.fields).map((field) => ({
    key: field.key,
    on: field.on,
  }));
  const mode = STAGE_DEFINITIONS[stage].items;
  const paper = mainDocument(stage)?.key ?? STEP_FORM;

  if (
    mode === "priced" &&
    !draft.lineItems.some((item) => Number(item.unitPrice) > 0)
  ) {
    missing.push({ key: itemFillKey(0, "unitPrice"), on: paper });
  }
  if (mode === "delivery") {
    draft.lineItems.forEach((item, index) => {
      if (!item.deliveredQuantity) {
        missing.push({ key: itemFillKey(index, "deliveredQuantity"), on: paper });
      }
    });
  }
  return missing;
}

/** The green button that finishes a step and hands the job on. */
function NextStepButton({
  nextStep,
  disabled,
  onClick,
}: {
  nextStep: InquiryView["steps"][number] | undefined;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="btn btn-go !items-center !py-1.5 text-left"
    >
      <span className="flex flex-col leading-tight">
        <span>
          {nextStep ? "Save & Go to Next Step" : "Save & Complete Inquiry"}
        </span>
        <span className="text-xs font-normal text-emerald-50">
          {nextStep
            ? `Goes to ${workflowDepartmentLabel(nextStep.departmentKey)} · ${nextStep.number}. ${nextStep.label}`
            : "The job is paid and closed"}
        </span>
      </span>
      <ArrowRightIcon className="h-5 w-5" />
    </button>
  );
}

export function InquiryDetailClient({
  orgCode,
  initialInquiry,
  backHref,
  company,
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
  /** Which of the step's papers is on screen. */
  const [openDocument, setOpenDocument] = useState<string | null>(null);
  /** Places that have to be filled in before the step can be completed. */
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());

  usePageTitle(inquiry.number || inquiry.customerName);

  /** Show a fresh copy of the inquiry and start its form from what is saved. */
  function show(next: InquiryView) {
    const nextDraft = draftOf(next);
    setInquiry(next);
    setSaved(nextDraft);
    setDraft(nextDraft);
    setViewing(next.currentStage);
    setInvalid(new Set());
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
  const approver =
    INQUIRY_APPROVAL_ROLES.find(
      (role) => role.key === currentStep.approvalRequiredBy,
    )?.label ?? "";
  // Once a step is sent for approval or approved it is not changed, unless
  // it is taken back first.
  const heldForApproval =
    inquiry.approvalRequested || inquiry.currentStageApproved;
  const editable = viewingCurrent && canEdit(inquiry) && !heldForApproval;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  // The step on screen shows what is typed; other steps show what is saved.
  const shown: InquiryStageInput = viewingCurrent
    ? draft
    : {
        fields: viewedStep.fields,
        tables: viewedStep.tables,
        lineItems: inquiry.lineItems,
      };
  // Prices typed on the inquiry or the quotation show in the totals at once.
  const quotationAnswers =
    viewedStep.key === "quotation"
      ? shown.fields
      : inquiry.steps.find((step) => step.key === "quotation")?.fields;
  const totals =
    editable && (definition.items === "entry" || definition.items === "priced")
      ? inquiryTotals(draft.lineItems, quotationAnswers)
      : inquiry.totals;

  const papers = documentsInUse(viewedStep.key, shown.fields);
  const paper = papers.find((doc) => doc.key === openDocument) ?? papers[0];

  /**
   * Whether everything the step needs is there. If not, the missing places
   * are marked in red and the first one is brought into view.
   */
  function complete(purpose: string): boolean {
    const missing = missingFrom(inquiry.currentStage, draft);
    if (missing.length === 0) return true;

    const first = missing[0]!;
    setInvalid(new Set(missing.map((item) => item.key)));
    setViewing(inquiry.currentStage);
    if (first.on !== STEP_FORM) setOpenDocument(first.on);
    // Jump to the first one once it is on screen.
    window.setTimeout(() => {
      const place = document.getElementById(fillId(first.key));
      place?.scrollIntoView({ block: "center", behavior: "smooth" });
      place?.focus({ preventScroll: true });
    }, 60);
    setError(
      missing.length === 1
        ? `One thing is still needed before this can ${purpose}. It is marked in red.`
        : `${missing.length} things are still needed before this can ${purpose}. They are marked in red.`,
    );
    return false;
  }

  async function save(moveOn: boolean) {
    if (moveOn && !complete("move on")) return;
    const updated = await run(() =>
      saveInquiryStageAction(orgCode, inquiry.id, draft, moveOn),
    );
    if (!updated) return;
    if (!moveOn) {
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

  async function sendForApproval() {
    if (!complete("be sent for approval")) return;
    if (
      await run(() => requestInquiryApprovalAction(orgCode, inquiry.id, draft))
    ) {
      showToast(`Sent to ${approver} for approval`);
    }
  }

  async function assign(staffId: string) {
    if (await run(() => assignInquiryAction(orgCode, inquiry.id, staffId))) {
      showToast("Assigned");
    }
  }

  async function approve() {
    if (await run(() => approveInquiryStageAction(orgCode, inquiry.id))) {
      showToast("Approved");
    }
  }

  /** Take the step back from approval so it can be changed. */
  async function reopenStep(reason: string): Promise<boolean> {
    return Boolean(
      await run(() => reopenInquiryStepAction(orgCode, inquiry.id, reason)),
    );
  }

  const sideActions: InquirySideActions = {
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

  const stepNumber =
    viewedStep.state === "locked" ? "" : viewedStep.documentNumber;
  // The number of every step the job has reached, and of their extra papers.
  const numbers = inquiry.steps.flatMap((step) =>
    step.state === "locked"
      ? []
      : [
          ...(step.documentNumber
            ? [{ key: step.key as string, label: step.label, number: step.documentNumber }]
            : []),
          ...documentsInUse(step.key, step.fields).flatMap((doc) =>
            step.documentNumbers[doc.key]
              ? [{ key: doc.key, label: doc.title, number: step.documentNumbers[doc.key]! }]
              : [],
          ),
        ],
  );
  const setFields = (fields: Record<string, string>) =>
    setDraft({ ...draft, fields });

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6 print:block print:p-0">
      <header className="card flex flex-col gap-3 p-4 sm:p-5 print:hidden">
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
          <HandlingBlock
            key={`${inquiry.currentStage}-${inquiry.assignedStaffId}`}
            inquiry={inquiry}
            staffOptions={assignable[inquiry.owningDepartmentKey] ?? []}
            myStaffId={myStaffId}
            pending={pending}
            onAssign={assign}
          />
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
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
          {numbers.map((item) => (
            <span
              key={item.key}
              className="chip bg-slate-100 text-slate-700 ring-1 ring-slate-200 ring-inset"
            >
              <span className="font-normal text-slate-500">{item.label}</span>
              <span className="tabular-nums">{item.number}</span>
            </span>
          ))}
        </div>
        {inquiry.status === "cancelled" ? (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
            Closed as lost: {inquiry.closeReason}
          </p>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-start print:block">
        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-72 print:hidden">
          <InquiryStepper
            steps={inquiry.steps}
            viewing={viewedStep.key}
            assignedStaffName={inquiry.assignedStaffName}
            onSelect={setViewing}
          />
          <InquiryExtras
            key={`${inquiry.currentStage}-${inquiry.status}`}
            inquiry={inquiry}
            pending={pending}
            actions={sideActions}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4 print:block">
          <form
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void save(false);
            }}
            className="card min-w-0"
          >
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-slate-200 px-4 py-4 sm:px-5 print:hidden">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Step {viewedStep.number} of {inquiry.steps.length}
                  </span>
                  <DepartmentChip department={viewedStep.departmentKey} />
                </div>
                <h3 className="mt-1.5 font-display text-lg font-semibold text-slate-900">
                  {viewedStep.label}
                </h3>
                <p className="mt-0.5 max-w-2xl text-sm text-slate-600">
                  {definition.purpose}
                </p>
              </div>
              {stepNumber ? (
                <div className="rounded-lg bg-slate-900 px-4 py-2 text-right text-white">
                  <p className="text-[11px] font-medium tracking-wide text-slate-300 uppercase">
                    {viewedStep.label} No.
                  </p>
                  <p className="font-display text-base font-semibold tabular-nums">
                    {stepNumber}
                  </p>
                </div>
              ) : null}
            </div>

            {viewingCurrent && inquiry.status === "open" ? (
              <ApprovalBanner
                inquiry={inquiry}
                approver={approver}
                pending={pending}
                onApprove={approve}
                onReopen={reopenStep}
              />
            ) : null}
            {viewedStep.state === "done" ? (
              <p className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 sm:px-5 print:hidden">
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
            {viewingCurrent &&
            inquiry.status === "open" &&
            !editable &&
            !heldForApproval ? (
              <p className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:px-5 print:hidden">
                <LockIcon className="h-4 w-4 text-amber-600" />
                {inquiry.canWork
                  ? "Assign someone above to start working on this step."
                  : `View only. This step is handled by ${workflowDepartmentLabel(inquiry.owningDepartmentKey)}.`}
              </p>
            ) : null}

            <div
              className={[
                "grid gap-6 px-4 py-5 sm:px-5 print:block print:p-0",
                // Filling in: the form on the left, the paper on the right.
                paper && editable
                  ? "xl:grid-cols-[minmax(19rem,22rem)_minmax(0,1fr)] 2xl:grid-cols-[minmax(21rem,26rem)_minmax(0,1fr)]"
                  : "",
              ].join(" ")}
            >
              {editable ? (
                <div className="flex min-w-0 flex-col gap-5 print:hidden">
                  {paper ? (
                    <p className="rounded-lg bg-primary-soft px-3 py-2 text-sm text-blue-900">
                      Fill in here. The {paper.title} beside it fills in as you
                      type; everything else on it comes from the earlier steps.
                    </p>
                  ) : null}
                  {hasFields(viewedStep.key, STEP_FORM) ? (
                    <StageFields
                      stage={viewedStep.key}
                      values={draft.fields}
                      disabled={pending}
                      invalid={invalid}
                      narrow={Boolean(paper)}
                      onChange={setFields}
                    />
                  ) : null}
                  {definition.items === "entry" ? (
                    <InquiryItems
                      items={draft.lineItems}
                      disabled={pending}
                      onChange={(lineItems) => setDraft({ ...draft, lineItems })}
                    />
                  ) : null}
                  {paper ? (
                    <>
                      {hasFields(viewedStep.key, paper.key) ? (
                        <div className="flex flex-col gap-3">
                          <h4 className="border-b border-slate-200 pb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            {paper.title}
                          </h4>
                          <StageFields
                            stage={viewedStep.key}
                            place={paper.key}
                            values={draft.fields}
                            disabled={pending}
                            invalid={invalid}
                            narrow
                            onChange={setFields}
                          />
                        </div>
                      ) : null}
                      <ItemsEditor
                        stage={viewedStep.key}
                        document={paper.key}
                        items={draft.lineItems}
                        disabled={pending}
                        invalid={invalid}
                        onChange={(lineItems) =>
                          setDraft({ ...draft, lineItems })
                        }
                      />
                      <TablesEditor
                        stage={viewedStep.key}
                        document={paper.key}
                        tables={draft.tables ?? {}}
                        disabled={pending}
                        onChange={(name, rows) =>
                          setDraft({
                            ...draft,
                            tables: { ...draft.tables, [name]: rows },
                          })
                        }
                      />
                    </>
                  ) : null}
                </div>
              ) : (
                <>
                  {hasFields(viewedStep.key, STEP_FORM) ? (
                    <div className="print:hidden">
                      <StageAnswers
                        stage={viewedStep.key}
                        values={shown.fields}
                      />
                    </div>
                  ) : null}
                  {definition.items === "entry" ? (
                    <div className="print:hidden">
                      <InquiryItems items={shown.lineItems} disabled />
                    </div>
                  ) : null}
                </>
              )}

              {paper ? (
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
                    <div className="flex flex-wrap gap-1 rounded-lg bg-slate-200/70 p-1">
                      {papers.map((doc) => (
                        <button
                          key={doc.key}
                          type="button"
                          aria-pressed={doc.key === paper.key}
                          onClick={() => setOpenDocument(doc.key)}
                          className={[
                            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                            doc.key === paper.key
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-600 hover:text-slate-900",
                          ].join(" ")}
                        >
                          <DocumentIcon className="h-3.5 w-3.5" />
                          {doc.title}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={editable && dirty}
                      title={
                        editable && dirty
                          ? "Save first, so the printout matches what is saved"
                          : undefined
                      }
                      onClick={() => window.print()}
                      className="btn btn-secondary btn-sm"
                    >
                      <PrinterIcon />
                      Print {paper.title}
                    </button>
                  </div>
                  {/* Shown a little smaller on a laptop screen so it fits beside
                      the form; it always prints full size. */}
                  <div
                    className={
                      editable
                        ? "xl:max-2xl:[zoom:0.8] print:[zoom:1]"
                        : undefined
                    }
                  >
                  <PaperProvider
                    state={{
                      company,
                      inquiry,
                      stage: viewedStep.key,
                      values: shown.fields,
                      items: shown.lineItems,
                      tables: shown.tables ?? {},
                      totals,
                    }}
                  >
                    <StagePaper document={paper.key} />
                  </PaperProvider>
                  </div>
                </div>
              ) : null}
            </div>

            {error ? (
              <p
                role="alert"
                className="flex items-start gap-2 border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:px-5 print:hidden"
              >
                <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            ) : null}

            {editable ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-4 sm:px-5 print:hidden">
                <button
                  type="button"
                  disabled={pending || !dirty}
                  onClick={() => {
                    setDraft(saved);
                    setInvalid(new Set());
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
                  {currentStep.approvalRequired ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void sendForApproval()}
                      className="btn btn-primary !items-center !py-1.5 text-left"
                    >
                      <span className="flex flex-col leading-tight">
                        <span>Send for Approval</span>
                        <span className="text-xs font-normal text-blue-100">
                          Goes to {approver} to approve
                        </span>
                      </span>
                      <ArrowRightIcon className="h-5 w-5" />
                    </button>
                  ) : (
                    <NextStepButton
                      nextStep={nextStep}
                      disabled={pending}
                      onClick={() => void save(true)}
                    />
                  )}
                </div>
              </div>
            ) : viewingCurrent &&
              canEdit(inquiry) &&
              inquiry.currentStageApproved ? (
              <div className="flex justify-end border-t border-slate-200 px-4 py-4 sm:px-5 print:hidden">
                <NextStepButton
                  nextStep={nextStep}
                  disabled={pending}
                  onClick={() => void save(true)}
                />
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </main>
  );
}
