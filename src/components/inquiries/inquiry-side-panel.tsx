"use client";

import { useState, type FormEvent } from "react";
import { AlertIcon, CheckIcon, UndoIcon, UserIcon } from "@/components/ui/icons";
import { formatFriendlyDateTime } from "@/lib/datetime/format";
import {
  INQUIRY_APPROVAL_ROLES,
  workflowDepartmentLabel,
} from "@/lib/inquiries/stages";
import type { AssignableStaff, InquiryView } from "@/lib/inquiries/types";

export type InquirySideActions = {
  assign: (staffId: string) => void;
  approve: () => void;
  addNote: (body: string) => Promise<boolean>;
  sendBack: (reason: string) => Promise<boolean>;
  close: (reason: string) => Promise<boolean>;
  reopen: () => void;
};

/** A button that opens a short "why?" box before doing something. */
function ReasonAction({
  label,
  prompt,
  confirmLabel,
  danger = false,
  icon,
  disabled,
  onConfirm,
}: {
  label: string;
  prompt: string;
  confirmLabel: string;
  danger?: boolean;
  icon?: React.ReactNode;
  disabled: boolean;
  onConfirm: (reason: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`btn btn-sm w-full ${danger ? "btn-danger" : "btn-secondary"}`}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <form
      className="rounded-lg border border-slate-200 bg-slate-50 p-3"
      onSubmit={async (event: FormEvent) => {
        event.preventDefault();
        if (await onConfirm(reason)) {
          setOpen(false);
          setReason("");
        }
      }}
    >
      <label className="field-label" htmlFor={`reason-${label}`}>
        {prompt}
      </label>
      <textarea
        id={`reason-${label}`}
        autoFocus
        rows={2}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        className="field mt-1.5 w-full"
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn btn-secondary btn-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={disabled || !reason.trim()}
          className={`btn btn-sm ${danger ? "btn-danger" : "btn-primary"}`}
        >
          {confirmLabel}
        </button>
      </div>
    </form>
  );
}

export function InquirySidePanel({
  inquiry,
  staffOptions,
  myStaffId,
  pending,
  actions,
}: {
  inquiry: InquiryView;
  staffOptions: AssignableStaff[];
  myStaffId: string;
  pending: boolean;
  actions: InquirySideActions;
}) {
  const [assignStaffId, setAssignStaffId] = useState("");
  const [note, setNote] = useState("");

  const open = inquiry.status === "open";
  const unassigned = open && !inquiry.assignedStaffId;
  const department = workflowDepartmentLabel(inquiry.owningDepartmentKey);
  const canAssignMe =
    inquiry.canAssign &&
    inquiry.assignedStaffId !== myStaffId &&
    staffOptions.some((staff) => staff.id === myStaffId);
  const approver =
    INQUIRY_APPROVAL_ROLES.find(
      (role) =>
        role.key ===
        inquiry.steps.find((step) => step.key === inquiry.currentStage)
          ?.approvalRequiredBy,
    )?.label ?? "";
  const approvalRequired = open && approver !== "";
  const firstStep = inquiry.steps[0]?.key === inquiry.currentStage;

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-80">
      {open ? (
        <section
          className={[
            "card p-4",
            unassigned ? "!border-orange-300 !bg-accent-soft" : "",
          ].join(" ")}
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            {unassigned ? (
              <AlertIcon className="h-4 w-4 text-accent" />
            ) : (
              <UserIcon className="h-4 w-4 text-slate-500" />
            )}
            Who is handling this step
          </h3>
          <p className="mt-1.5 text-sm text-slate-700">
            {inquiry.assignedStaffName ? (
              <span className="font-medium">{inquiry.assignedStaffName}</span>
            ) : (
              `Nobody yet. Someone from ${department} has to be assigned before work can start.`
            )}
          </p>
          {inquiry.canAssign ? (
            <div className="mt-3 flex flex-col gap-2">
              {canAssignMe ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => actions.assign(myStaffId)}
                  className="btn btn-primary btn-sm"
                >
                  Assign to me
                </button>
              ) : null}
              <div className="flex gap-2">
                <select
                  aria-label={`Choose someone from ${department}`}
                  value={assignStaffId}
                  onChange={(event) => setAssignStaffId(event.target.value)}
                  className="field min-w-0 flex-1 !py-1.5"
                >
                  <option value="">Choose from {department}…</option>
                  {staffOptions.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.fullName}
                      {staff.jobTitle ? ` · ${staff.jobTitle}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={pending || !assignStaffId}
                  onClick={() => {
                    actions.assign(assignStaffId);
                    setAssignStaffId("");
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  Assign
                </button>
              </div>
              {staffOptions.length === 0 ? (
                <p className="text-xs text-slate-600">
                  Nobody is in {department} yet. Add the department to a staff
                  member under Staff.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {approvalRequired ? (
        <section
          className={[
            "card p-4",
            inquiry.currentStageApproved
              ? "!border-emerald-300 !bg-emerald-50"
              : "!border-amber-300 !bg-amber-50",
          ].join(" ")}
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            {inquiry.currentStageApproved ? (
              <CheckIcon className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertIcon className="h-4 w-4 text-amber-600" />
            )}
            {inquiry.currentStageApproved
              ? `Approved by ${approver}`
              : `Needs approval by ${approver}`}
          </h3>
          {!inquiry.currentStageApproved ? (
            <p className="mt-1.5 text-sm text-slate-700">
              Save the step, then {approver} approves it before it can move on.
            </p>
          ) : null}
          {inquiry.canApproveCurrentStage ? (
            <button
              type="button"
              disabled={pending || unassigned}
              onClick={actions.approve}
              className="btn btn-go btn-sm mt-3 w-full"
            >
              <CheckIcon />
              Approve this step
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="card">
        <h3 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
          Notes
        </h3>
        <div className="max-h-56 space-y-3 overflow-y-auto px-4 py-3">
          {inquiry.comments.length === 0 ? (
            <p className="text-sm text-slate-500">
              No notes yet. Leave one for whoever picks this up next.
            </p>
          ) : (
            inquiry.comments.map((item) => (
              <div key={item.id} className="text-sm">
                <p className="font-medium text-slate-900">
                  {item.authorName}
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {formatFriendlyDateTime(new Date(item.createdAt))}
                  </span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-slate-700">
                  {item.body}
                </p>
              </div>
            ))
          )}
        </div>
        <form
          className="border-t border-slate-200 p-3"
          onSubmit={async (event: FormEvent) => {
            event.preventDefault();
            if (await actions.addNote(note)) setNote("");
          }}
        >
          <textarea
            aria-label="Write a note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="Write a note…"
            className="field w-full"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={pending || !note.trim()}
              className="btn btn-secondary btn-sm"
            >
              Add note
            </button>
          </div>
        </form>
      </section>

      {inquiry.canWork || inquiry.canClose ? (
        <section className="card flex flex-col gap-2 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Other actions</h3>
          {inquiry.canWork && !firstStep ? (
            <ReasonAction
              label="Send back to the previous step"
              prompt="What has to be fixed?"
              confirmLabel="Send back"
              icon={<UndoIcon />}
              disabled={pending || unassigned}
              onConfirm={actions.sendBack}
            />
          ) : null}
          {inquiry.canClose && open ? (
            <ReasonAction
              label="Close as lost"
              prompt="Why is this inquiry not going ahead?"
              confirmLabel="Close inquiry"
              danger
              disabled={pending}
              onConfirm={actions.close}
            />
          ) : null}
          {inquiry.canClose && inquiry.status === "cancelled" ? (
            <button
              type="button"
              disabled={pending}
              onClick={actions.reopen}
              className="btn btn-secondary btn-sm w-full"
            >
              Reopen this inquiry
            </button>
          ) : null}
          {unassigned && inquiry.canWork && !firstStep ? (
            <p className="text-xs text-slate-500">
              Assign someone to send it back.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="card">
        <h3 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
          History
        </h3>
        <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
          {[...inquiry.activityLogs].reverse().map((item) => (
            <li key={item.id} className="px-4 py-2.5">
              <p className="text-sm font-medium text-slate-900">{item.label}</p>
              {item.detail ? (
                <p className="mt-0.5 text-xs text-slate-600">{item.detail}</p>
              ) : null}
              <p className="mt-0.5 text-xs text-slate-500">
                {item.actorName ? `${item.actorName} · ` : ""}
                {formatFriendlyDateTime(new Date(item.occurredAt))}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
