"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  appDateValue,
  appTimeValue,
  formatFriendlyDateTime,
} from "@/lib/datetime/format";
import { useServerState } from "@/lib/react/use-server-state";
import { createVisitorLogAction } from "@/lib/visitors/actions";
import {
  VISITOR_PURPOSES,
  visitorPurposeLabel,
  type VisitorLogInput,
  type VisitorLogView,
  type VisitorPurpose,
} from "@/lib/visitors/types";
import { unwrap } from "@/lib/actions/result";

type VisitorsPanelProps = {
  orgCode: string;
  initialVisitors: VisitorLogView[];
};

function emptyForm(): VisitorLogInput {
  const now = new Date();
  return {
    fullName: "",
    visitDate: appDateValue(now),
    visitTime: appTimeValue(now),
    purpose: "inquiry",
    notes: "",
  };
}

export function VisitorsPanel({
  orgCode,
  initialVisitors,
}: VisitorsPanelProps) {
  const router = useRouter();
  const [visitors, setVisitors] = useServerState(initialVisitors);
  const [editorOpen, setEditorOpen] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [createdItem, setCreatedItem] = useState<VisitorLogView | null>(null);
  const [form, setForm] = useState<VisitorLogInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function openCreate() {
    setForm(emptyForm());
    setError(null);
    setCreateSuccess(false);
    setCreatedItem(null);
    setEditorOpen(true);
  }

  function closeEditor() {
    if (pending) return;
    setEditorOpen(false);
    setForm(emptyForm());
    setError(null);
    setCreateSuccess(false);
    setCreatedItem(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const created = await unwrap(createVisitorLogAction(orgCode, form));
      setVisitors((current) => [
        created,
        ...current.filter((item) => item.id !== created.id),
      ]);
      setCreatedItem(created);
      setCreateSuccess(true);
      setForm(emptyForm());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log visitor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-4xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Visitors
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Log walk-in visitors and calls handled at reception.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="btn btn-primary shrink-0"
        >
          Log a Visitor/Call
        </button>
      </div>

      <div className="card mt-4">
        <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Visitor log
          </h3>
        </div>

        {visitors.length === 0 ? (
          <p className="px-4 py-5 text-sm text-slate-600 sm:px-5">
            No visitors logged yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {visitors.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-3 items-center gap-3 px-4 py-3 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {item.fullName}
                  </p>
                  {item.inquiryId ? (
                    <p className="mt-0.5 truncate text-xs text-emerald-700">
                      Inquiry, Sent to Admin Department
                    </p>
                  ) : null}
                </div>
                <p className="truncate text-center text-sm text-slate-600">
                  {visitorPurposeLabel(item.purpose)}
                </p>
                <p className="truncate text-right text-sm text-slate-500">
                  {formatFriendlyDateTime(new Date(item.visitedAt))}
                </p>
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
            aria-labelledby="visitor-log-title"
            className="card max-h-[90vh] w-full max-w-lg overflow-auto shadow-lg"
          >
            {createSuccess && createdItem ? (
              <>
                <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
                  <h3
                    id="visitor-log-title"
                    className="font-display text-base font-semibold text-slate-900"
                  >
                    Visitor logged
                  </h3>
                </div>
                <div className="px-4 py-5 sm:px-5">
                  <div className="flex items-start gap-3 border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900 rounded-lg">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <div>
                      <p>
                        Logged{" "}
                        <span className="font-medium">
                          {createdItem.fullName}
                        </span>
                        .
                      </p>
                      <p className="mt-1 text-emerald-800">
                        {visitorPurposeLabel(createdItem.purpose)} ·{" "}
                        {formatFriendlyDateTime(
                          new Date(createdItem.visitedAt),
                        )}
                      </p>
                      {createdItem.inquiryId ? (
                        <p className="mt-1 text-emerald-800">
                          Inquiry, Sent to Admin Department
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end border-t border-slate-200 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="btn btn-primary"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={onSubmit}>
                <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
                  <h3
                    id="visitor-log-title"
                    className="font-display text-base font-semibold text-slate-900"
                  >
                    Log a Visitor/Call
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Record who visited or called and why.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="field-label">
                      Name
                    </span>
                    <input
                      required
                      value={form.fullName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          fullName: event.target.value,
                        }))
                      }
                      className="field"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">
                      Date
                    </span>
                    <input
                      type="date"
                      required
                      min="1900-01-01"
                      max="2100-12-31"
                      value={form.visitDate}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          visitDate: event.target.value.slice(0, 10),
                        }))
                      }
                      className="field"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="field-label">
                      Time
                    </span>
                    <input
                      type="time"
                      required
                      value={form.visitTime}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          visitTime: event.target.value.slice(0, 5),
                        }))
                      }
                      className="field"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="field-label">
                      Purpose
                    </span>
                    <select
                      value={form.purpose}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          purpose: event.target.value as VisitorPurpose,
                        }))
                      }
                      className="field"
                    >
                      {VISITOR_PURPOSES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    {form.purpose === "inquiry" ? (
                      <span className="text-xs text-slate-500">
                        Inquiry purpose sends a starter inquiry to Admin.
                      </span>
                    ) : null}
                  </label>

                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="field-label">
                      Notes
                    </span>
                    <textarea
                      value={form.notes}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      rows={3}
                      className="field"
                    />
                  </label>
                </div>

                {error ? (
                  <div className="border-t border-slate-200 px-4 py-3 text-sm text-red-700 sm:px-5">
                    {error}
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={closeEditor}
                    disabled={pending}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending || !form.fullName.trim()}
                    className="btn btn-primary"
                  >
                    {pending ? "Saving…" : "Save log"}
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
