"use client";

import { useState, type FormEvent } from "react";
import {
  emptyLineItem,
  InquiryItems,
  StageFields,
} from "@/components/inquiries/stage-form";
import { AlertIcon, CloseIcon } from "@/components/ui/icons";
import { unwrap } from "@/lib/actions/result";
import { createInquiryAction } from "@/lib/inquiries/actions";
import type { InquiryStageInput, InquiryView } from "@/lib/inquiries/types";

const emptyInquiry = (): InquiryStageInput => ({
  fields: { jobType: "local" },
  lineItems: [emptyLineItem()],
});

/** Start a new inquiry by filling in its first step. */
export function NewInquiryDialog({
  orgCode,
  onClose,
  onCreated,
}: {
  orgCode: string;
  onClose: () => void;
  onCreated: (inquiry: InquiryView) => void;
}) {
  const [form, setForm] = useState(emptyInquiry);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      onCreated(await unwrap(createInquiryAction(orgCode, form)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create it.");
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-inquiry-title"
        onSubmit={onSubmit}
        className="card flex max-h-[90vh] w-full max-w-3xl flex-col shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3
              id="new-inquiry-title"
              className="font-display text-lg font-semibold text-slate-900"
            >
              New inquiry
            </h3>
            <p className="mt-0.5 text-sm text-slate-600">
              Only the customer&apos;s name is needed to start. The rest can be
              filled in on the inquiry before it moves to the quotation.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={pending}
            className="cursor-pointer rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-6 overflow-y-auto px-5 py-5">
          <StageFields
            stage="inquiry"
            values={form.fields}
            disabled={pending}
            onChange={(fields) => setForm({ ...form, fields })}
          />
          <InquiryItems
            items={form.lineItems}
            disabled={pending}
            onChange={(lineItems) => setForm({ ...form, lineItems })}
          />
        </div>
        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 border-t border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800"
          >
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || !form.fields.customerName?.trim()}
            className="btn btn-primary"
          >
            {pending ? "Creating…" : "Create inquiry"}
          </button>
        </div>
      </form>
    </div>
  );
}
