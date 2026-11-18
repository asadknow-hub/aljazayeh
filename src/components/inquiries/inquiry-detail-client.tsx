"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { useToast } from "@/components/providers/toast-provider";
import { InquiryFormFields } from "@/components/inquiries/inquiry-form-fields";
import {
  formatFriendlyDate,
  formatFriendlyDateTime,
} from "@/lib/datetime/format";
import {
  addInquiryCommentAction,
  approveInquiryStageAction,
  assignInquiryAction,
  listAssignableStaffAction,
  moveInquiryStageAction,
  updateInquiryAction,
} from "@/lib/inquiries/actions";
import {
  adjacentInquiryStages,
  INQUIRY_APPROVAL_ROLES,
  INQUIRY_STAGES,
  inquiryStageLabel,
  workflowDepartmentLabel,
} from "@/lib/inquiries/stages";
import type { InquiryCreateInput, InquiryView } from "@/lib/inquiries/types";

type StaffOption = { id: string; fullName: string; jobTitle: string };

function formFromInquiry(inquiry: InquiryView): InquiryCreateInput {
  return {
    customerName: inquiry.customerName,
    contact: inquiry.contact,
    deliveryExpectedOn: inquiry.deliveryExpectedOn,
    notes: inquiry.notes,
    lineItems: inquiry.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  };
}

type InquiryDetailClientProps = {
  orgCode: string;
  initialInquiry: InquiryView;
  backHref: string;
};

export function InquiryDetailClient({
  orgCode,
  initialInquiry,
}: InquiryDetailClientProps) {
  usePageTitle(initialInquiry.customerName);
  const router = useRouter();
  const { showToast } = useToast();
  const [inquiry, setInquiry] = useState(initialInquiry);
  const [form, setForm] = useState(() => formFromInquiry(initialInquiry));
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [assignStaffId, setAssignStaffId] = useState(
    initialInquiry.assignedStaffId ?? "",
  );
  const [commentDraft, setCommentDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const locked = !inquiry.assignedStaffId;

  // A fresh copy from the server replaces local edits.
  const [seenInitial, setSeenInitial] = useState(initialInquiry);
  if (seenInitial !== initialInquiry) {
    setSeenInitial(initialInquiry);
    setInquiry(initialInquiry);
    setForm(formFromInquiry(initialInquiry));
    setAssignStaffId(initialInquiry.assignedStaffId ?? "");
  }

  useEffect(() => {
    let cancelled = false;
    listAssignableStaffAction(orgCode, inquiry.owningDepartmentKey)
      .then((rows) => {
        if (!cancelled) setStaffOptions(rows);
      })
      .catch(() => {
        if (!cancelled) setStaffOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [orgCode, inquiry.owningDepartmentKey]);

  const neighbors = useMemo(
    () => adjacentInquiryStages(inquiry.currentStage),
    [inquiry.currentStage],
  );

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (pending || locked) return;
    setError(null);
    setPending(true);
    try {
      const updated = await updateInquiryAction(orgCode, inquiry.id, form);
      setInquiry(updated);
      showToast("Inquiry saved");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  async function onAssign() {
    if (!assignStaffId || pending) return;
    setError(null);
    setPending(true);
    try {
      const updated = await assignInquiryAction(
        orgCode,
        inquiry.id,
        assignStaffId,
      );
      setInquiry(updated);
      showToast("Assigned");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign.");
    } finally {
      setPending(false);
    }
  }

  async function onMove(direction: "previous" | "next") {
    if (pending || locked) return;
    setError(null);
    setPending(true);
    try {
      const updated = await moveInquiryStageAction(
        orgCode,
        inquiry.id,
        direction,
      );
      setInquiry(updated);
      setAssignStaffId(updated.assignedStaffId ?? "");
      showToast(
        direction === "next" ? "Moved to next stage" : "Moved to previous stage",
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move stage.");
    } finally {
      setPending(false);
    }
  }

  async function onApprove() {
    if (pending || locked) return;
    setError(null);
    setPending(true);
    try {
      const updated = await approveInquiryStageAction(orgCode, inquiry.id);
      setInquiry(updated);
      showToast("Stage approved");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve.");
    } finally {
      setPending(false);
    }
  }

  const approvalRoleLabel =
    INQUIRY_APPROVAL_ROLES.find(
      (role) => role.key === inquiry.approvalRequiredBy,
    )?.label ?? inquiry.approvalRequiredBy;
  const nextBlockedByApproval =
    Boolean(neighbors.next) &&
    inquiry.approvalRequired &&
    !inquiry.currentStageApproved;

  async function onPostComment(event: FormEvent) {
    event.preventDefault();
    if (pending || locked || !commentDraft.trim()) return;
    setError(null);
    setPending(true);
    try {
      const updated = await addInquiryCommentAction(
        orgCode,
        inquiry.id,
        commentDraft,
      );
      setInquiry(updated);
      setCommentDraft("");
      showToast("Comment posted");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post comment.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-start">
        <aside className="w-full shrink-0 border border-zinc-300 bg-white lg:w-52">
          <div className="border-b border-zinc-200 px-3 py-3">
            <h3 className="font-display text-sm font-semibold text-zinc-900">
              Workflow
            </h3>
          </div>
          <nav className="flex flex-col gap-1 p-2">
            {INQUIRY_STAGES.map((stage) => {
              const active = stage.key === inquiry.currentStage;
              return (
                <span
                  key={stage.key}
                  className={[
                    "px-3 py-2 text-left text-sm font-medium",
                    active
                      ? "bg-header text-header-fg"
                      : "bg-zinc-50 text-zinc-600",
                  ].join(" ")}
                >
                  {stage.label}
                </span>
              );
            })}
          </nav>
          <div className="flex flex-col gap-2 border-t border-zinc-200 p-3">
            {inquiry.approvalRequired ? (
              <div
                className={[
                  "border px-3 py-2 text-xs",
                  inquiry.currentStageApproved
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-amber-300 bg-amber-50 text-amber-900",
                ].join(" ")}
              >
                {inquiry.currentStageApproved
                  ? `Approved by ${approvalRoleLabel}`
                  : `Approval required by ${approvalRoleLabel} before next stage.`}
                {inquiry.canApproveCurrentStage &&
                !inquiry.currentStageApproved ? (
                  <button
                    type="button"
                    disabled={pending || locked}
                    onClick={onApprove}
                    className="mt-2 w-full border border-amber-400 bg-white px-2 py-1.5 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-45"
                  >
                    Approve stage
                  </button>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              disabled={pending || locked || !neighbors.previous}
              onClick={() => onMove("previous")}
              className="border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-45"
            >
              Previous stage
            </button>
            <button
              type="button"
              disabled={
                pending || locked || !neighbors.next || nextBlockedByApproval
              }
              onClick={() => onMove("next")}
              className="bg-header px-3 py-1.5 text-sm font-medium text-header-fg hover:bg-header-control disabled:opacity-45"
            >
              Next stage
            </button>
          </div>
        </aside>

        <form
          onSubmit={onSave}
          className="min-w-0 flex-1 border border-zinc-300 bg-white"
        >
          <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
            <h2 className="font-display text-base font-semibold text-zinc-900">
              {inquiry.customerName}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Stage: {inquiryStageLabel(inquiry.currentStage)}
              {inquiry.deliveryExpectedOn
                ? ` · Delivery ${formatFriendlyDate(inquiry.deliveryExpectedOn)}`
                : ""}
            </p>
          </div>
          <div className="px-4 py-4 sm:px-5">
            <InquiryFormFields
              form={form}
              onChange={setForm}
              disabled={locked || pending}
              commentsSlot={
                <div className="border border-zinc-200">
                  <div className="border-b border-zinc-200 px-3 py-2">
                    <h3 className="text-[12px] font-medium text-zinc-700">
                      Notes
                    </h3>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Post a comment for others working on this inquiry.
                    </p>
                  </div>
                  <div className="max-h-56 space-y-3 overflow-y-auto px-3 py-3">
                    {inquiry.comments.length === 0 ? (
                      <p className="text-sm text-zinc-500">No comments yet.</p>
                    ) : (
                      inquiry.comments.map((item) => (
                        <div key={item.id} className="text-sm">
                          <p className="font-medium text-zinc-900">
                            {item.authorName}
                            <span className="ml-2 text-xs font-normal text-zinc-500">
                              {formatFriendlyDateTime(new Date(item.createdAt))}
                            </span>
                          </p>
                          <p className="mt-0.5 whitespace-pre-wrap text-zinc-700">
                            {item.body}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t border-zinc-200 p-3">
                    <textarea
                      value={commentDraft}
                      disabled={locked || pending}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      rows={3}
                      placeholder={
                        locked
                          ? "Assign someone to unlock notes"
                          : "Write a comment…"
                      }
                      className="w-full border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header disabled:cursor-not-allowed disabled:bg-zinc-50"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        disabled={
                          locked || pending || !commentDraft.trim()
                        }
                        onClick={onPostComment}
                        className="bg-header px-3 py-1.5 text-sm font-medium text-header-fg hover:bg-header-control disabled:opacity-45"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              }
            />
          </div>
          {error ? (
            <div className="border-t border-zinc-200 px-4 py-3 text-sm text-red-700 sm:px-5">
              {error}
            </div>
          ) : null}
          <div className="flex justify-end border-t border-zinc-200 px-4 py-3 sm:px-5">
            <button
              type="submit"
              disabled={pending || locked}
              className="bg-header px-3 py-1.5 text-sm font-medium text-header-fg hover:bg-header-control disabled:opacity-45"
            >
              {pending ? "Saving…" : "Save inquiry"}
            </button>
          </div>
        </form>

        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-72">
          <div
            className={[
              "border p-4 sm:p-5",
              locked
                ? "border-red-400 bg-red-50"
                : "border-zinc-300 bg-white",
            ].join(" ")}
          >
            <div className="flex items-start gap-2">
              {locked ? (
                <span
                  aria-hidden
                  className="mt-0.5 text-base font-bold text-red-600"
                >
                  !
                </span>
              ) : null}
              <div className="min-w-0 flex-1">
                <h3
                  className={[
                    "font-display text-sm font-semibold",
                    locked ? "text-red-800" : "text-zinc-900",
                  ].join(" ")}
                >
                  Assign person
                </h3>
                {locked ? (
                  <p className="mt-1 text-sm text-red-700">
                    Please assign yourself or someone to start on this.
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-zinc-600">
                    Staff with the{" "}
                    {workflowDepartmentLabel(inquiry.owningDepartmentKey)} role.
                    Clears when the inquiry moves to another department.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <select
                value={assignStaffId}
                onChange={(event) => setAssignStaffId(event.target.value)}
                className={[
                  "w-full border bg-white px-3 py-2 text-sm outline-none focus:border-header",
                  locked ? "border-red-300" : "border-zinc-300",
                ].join(" ")}
              >
                <option value="">Select staff</option>
                {staffOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fullName}
                    {item.jobTitle ? ` · ${item.jobTitle}` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={pending || !assignStaffId}
                onClick={onAssign}
                className="bg-header px-3 py-1.5 text-sm font-medium text-header-fg hover:bg-header-control disabled:opacity-45"
              >
                Assign
              </button>
            </div>
            {staffOptions.length === 0 ? (
              <p
                className={[
                  "mt-2 text-xs",
                  locked ? "text-red-600" : "text-zinc-500",
                ].join(" ")}
              >
                No staff assigned to this department role yet.
              </p>
            ) : null}
          </div>

          <div className="border border-zinc-300 bg-white">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h3 className="font-display text-sm font-semibold text-zinc-900">
                Inquiry log
              </h3>
            </div>
            <ul className="max-h-80 divide-y divide-zinc-200 overflow-y-auto">
              {inquiry.activityLogs.length === 0 ? (
                <li className="px-4 py-3 text-sm text-zinc-500">
                  No activity yet.
                </li>
              ) : (
                inquiry.activityLogs.map((item) => (
                  <li key={item.id} className="px-4 py-3">
                    <p className="text-sm font-medium text-zinc-900">
                      {item.label}
                    </p>
                    {item.detail ? (
                      <p className="mt-0.5 text-xs text-zinc-600">
                        {item.detail}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.actorName ? `${item.actorName} · ` : ""}
                      {formatFriendlyDateTime(new Date(item.occurredAt))}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
