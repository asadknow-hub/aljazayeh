"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  emptyInquiryForm,
  InquiryFormFields,
} from "@/components/inquiries/inquiry-form-fields";
import { formatFriendlyDate } from "@/lib/datetime/format";
import { createInquiryAction } from "@/lib/inquiries/actions";
import { inquiryStageLabel } from "@/lib/inquiries/stages";
import type { InquiryCreateInput, InquiryView } from "@/lib/inquiries/types";
import { workflowDepartmentLabel } from "@/lib/inquiries/validate";

type InquiriesListPanelProps = {
  orgCode: string;
  initialInquiries: InquiryView[];
  detailBasePath: string;
  title?: string;
  description?: string;
  allowCreate?: boolean;
};

export function InquiriesListPanel({
  orgCode,
  initialInquiries,
  detailBasePath,
  title = "Inquiries",
  description = "Full CRM inquiry pipeline.",
  allowCreate = true,
}: InquiriesListPanelProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialInquiries);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<InquiryCreateInput>(emptyInquiryForm());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [created, setCreated] = useState<InquiryView | null>(null);

  useEffect(() => {
    setItems(initialInquiries);
  }, [initialInquiries]);

  function openCreate() {
    setForm(emptyInquiryForm());
    setError(null);
    setCreateSuccess(false);
    setCreated(null);
    setEditorOpen(true);
  }

  function closeEditor() {
    if (pending) return;
    setEditorOpen(false);
    setForm(emptyInquiryForm());
    setError(null);
    setCreateSuccess(false);
    setCreated(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const next = await createInquiryAction(orgCode, form);
      setItems((current) => [next, ...current.filter((item) => item.id !== next.id)]);
      setCreated(next);
      setCreateSuccess(true);
      setForm(emptyInquiryForm());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create inquiry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-5xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-zinc-900">
            {title}
          </h2>
          <p className="mt-1 text-sm text-zinc-600">{description}</p>
        </div>
        {allowCreate ? (
          <button
            type="button"
            onClick={openCreate}
            className="shrink-0 bg-header px-3 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control"
          >
            New inquiry
          </button>
        ) : null}
      </div>

      <div className="mt-4 border border-zinc-300 bg-white">
        {items.length === 0 ? (
          <p className="px-4 py-5 text-sm text-zinc-600 sm:px-5">
            No inquiries yet.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`${detailBasePath}/${item.id}`}
                  className="flex flex-col gap-1 px-4 py-3 transition hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {item.customerName}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {item.assignedStaffName
                        ? `Assigned: ${item.assignedStaffName}`
                        : "Unassigned"}
                      {item.deliveryExpectedOn
                        ? ` · Due ${formatFriendlyDate(item.deliveryExpectedOn)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-zinc-600">
                    <span>{inquiryStageLabel(item.currentStage)}</span>
                    <span>·</span>
                    <span>
                      {workflowDepartmentLabel(item.owningDepartmentKey)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-3xl overflow-auto border border-zinc-300 bg-white shadow-lg"
          >
            {createSuccess && created ? (
              <>
                <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
                  <h3 className="font-display text-base font-semibold text-zinc-900">
                    Inquiry created
                  </h3>
                </div>
                <div className="px-4 py-5 text-sm text-emerald-800 sm:px-5">
                  {created.customerName} is in{" "}
                  {workflowDepartmentLabel(created.owningDepartmentKey)} at
                  Inquiry stage (unassigned).
                </div>
                <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={() => {
                      closeEditor();
                      router.push(`${detailBasePath}/${created.id}`);
                    }}
                    className="border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Open inquiry
                  </button>
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="bg-header px-3 py-1.5 text-sm font-medium text-header-fg hover:bg-header-control"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={onSubmit}>
                <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
                  <h3 className="font-display text-base font-semibold text-zinc-900">
                    New inquiry
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600">
                    Starts at Inquiry stage in the mapped department, unassigned.
                  </p>
                </div>
                <div className="px-4 py-4 sm:px-5">
                  <InquiryFormFields form={form} onChange={setForm} />
                </div>
                {error ? (
                  <div className="border-t border-zinc-200 px-4 py-3 text-sm text-red-700 sm:px-5">
                    {error}
                  </div>
                ) : null}
                <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={closeEditor}
                    disabled={pending}
                    className="border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-45"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending || !form.customerName.trim()}
                    className="bg-header px-3 py-1.5 text-sm font-medium text-header-fg hover:bg-header-control disabled:opacity-45"
                  >
                    {pending ? "Saving…" : "Create inquiry"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
