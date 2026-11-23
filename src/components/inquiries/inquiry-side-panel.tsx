"use client";

import { useState, type FormEvent } from "react";
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  UndoIcon,
  UserIcon,
} from "@/components/ui/icons";
import { formatFriendlyDateTime } from "@/lib/datetime/format";
import { workflowDepartmentLabel } from "@/lib/inquiries/stages";
import type { AssignableStaff, InquiryView } from "@/lib/inquiries/types";

export type InquirySideActions = {
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
  inline = false,
}: {
  label: string;
  prompt: string;
  confirmLabel: string;
  danger?: boolean;
  icon?: React.ReactNode;
  disabled: boolean;
  onConfirm: (reason: string) => Promise<boolean>;
  /** Sits in a row of buttons instead of filling the width. */
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`btn ${inline ? "" : "btn-sm w-full"} ${danger ? "btn-danger" : "btn-secondary"}`}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <form
      className={`rounded-lg border border-slate-200 bg-slate-50 p-3 ${inline ? "w-72" : ""}`}
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

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/** Who is handling the current step, with a way to change it. */
export function HandlingBlock({
  inquiry,
  staffOptions,
  myStaffId,
  pending,
  onAssign,
}: {
  inquiry: InquiryView;
  staffOptions: AssignableStaff[];
  myStaffId: string;
  pending: boolean;
  onAssign: (staffId: string) => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const [assignStaffId, setAssignStaffId] = useState("");

  if (inquiry.status !== "open") return null;

  const assigned = inquiry.assignedStaffName;
  const department = workflowDepartmentLabel(inquiry.owningDepartmentKey);
  const canAssignMe =
    inquiry.canAssign &&
    inquiry.assignedStaffId !== myStaffId &&
    staffOptions.some((staff) => staff.id === myStaffId);

  return (
    <div
      className={[
        "flex flex-wrap items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-inset",
        assigned
          ? "bg-slate-50 ring-slate-200"
          : "bg-accent-soft ring-orange-300",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={[
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          assigned ? "bg-primary text-white" : "bg-orange-200 text-accent",
        ].join(" ")}
      >
        {assigned ? initialsOf(assigned) : <AlertIcon className="h-5 w-5" />}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
          Handling this step
        </p>
        <p
          className={[
            "font-display text-base leading-tight font-semibold",
            assigned ? "text-slate-900" : "text-accent",
          ].join(" ")}
        >
          {assigned ?? `Nobody yet · assign someone from ${department}`}
        </p>
      </div>

      {inquiry.canAssign ? (
        choosing || !assigned ? (
          <div className="flex flex-wrap items-center gap-2">
            {canAssignMe ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  onAssign(myStaffId);
                  setChoosing(false);
                }}
                className="btn btn-primary btn-sm"
              >
                Assign to me
              </button>
            ) : null}
            <select
              aria-label={`Choose someone from ${department}`}
              value={assignStaffId}
              onChange={(event) => setAssignStaffId(event.target.value)}
              className="field !py-1.5"
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
                onAssign(assignStaffId);
                setAssignStaffId("");
                setChoosing(false);
              }}
              className="btn btn-secondary btn-sm"
            >
              Assign
            </button>
            {assigned ? (
              <button
                type="button"
                onClick={() => setChoosing(false)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
            ) : null}
            {staffOptions.length === 0 ? (
              <p className="w-full text-xs text-slate-600">
                Nobody is in {department} yet. Add the department to a staff
                member under Staff.
              </p>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setChoosing(true)}
            className="btn btn-secondary btn-sm"
          >
            <UserIcon />
            Change
          </button>
        )
      ) : null}
    </div>
  );
}

/**
 * Where a step that needs approval stands: sent and waiting, or approved.
 * The approver gets the buttons to approve it or ask for changes; the person
 * handling the step can take it back to change something.
 */
export function ApprovalBanner({
  inquiry,
  approver,
  pending,
  onApprove,
  onReopen,
}: {
  inquiry: InquiryView;
  /** Who approves this step: "Owners", or a position's title. */
  approver: string;
  pending: boolean;
  onApprove: () => void;
  onReopen: (reason: string) => Promise<boolean>;
}) {
  if (!inquiry.approvalRequested && !inquiry.currentStageApproved) return null;
  const approved = inquiry.currentStageApproved;

  return (
    <div
      className={[
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 sm:px-5 print:hidden",
        approved
          ? "border-emerald-200 bg-emerald-50"
          : "border-amber-200 bg-amber-50",
      ].join(" ")}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={[
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            approved
              ? "bg-emerald-600 text-white"
              : "bg-amber-400 text-amber-950",
          ].join(" ")}
        >
          {approved ? (
            <CheckIcon className="h-4 w-4" />
          ) : (
            <ClockIcon className="h-4 w-4" />
          )}
        </span>
        <div>
          <p className="font-display text-base font-semibold text-slate-900">
            {approved
              ? `Approved by ${approver}`
              : inquiry.canApproveCurrentStage
                ? "Waiting for your approval"
                : `Done. Sent to ${approver} for approval`}
          </p>
          <p className="text-sm text-slate-700">
            {approved
              ? "It can move on to the next step now."
              : inquiry.canApproveCurrentStage
                ? "Check the details below, then approve it or ask for changes."
                : `Nothing more to do here until it is approved by ${approver}.`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-2">
        {inquiry.canApproveCurrentStage ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={onApprove}
              className="btn btn-go"
            >
              <CheckIcon />
              Approve
            </button>
            <ReasonAction
              label="Ask for changes"
              prompt="What has to be changed?"
              confirmLabel="Send back for changes"
              disabled={pending}
              onConfirm={onReopen}
              inline
            />
          </>
        ) : inquiry.canWork ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void onReopen("")}
            className="btn btn-secondary btn-sm"
          >
            Change something
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Notes, the less common actions and the history of the inquiry. */
export function InquiryExtras({
  inquiry,
  pending,
  actions,
}: {
  inquiry: InquiryView;
  pending: boolean;
  actions: InquirySideActions;
}) {
  const [note, setNote] = useState("");

  const open = inquiry.status === "open";
  const unassigned = open && !inquiry.assignedStaffId;
  const firstStep = inquiry.steps[0]?.key === inquiry.currentStage;

  return (
    <div className="flex flex-col gap-4 print:hidden">
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
    </div>
  );
}
