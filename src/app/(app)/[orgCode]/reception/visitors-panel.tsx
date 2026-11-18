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
      const created = await createVisitorLogAction(orgCode, form);
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
          <h2 className="font-display text-xl font-semibold text-zinc-900">
            Visitors
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Log walk-in visitors and calls handled at reception.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="shrink-0 bg-header px-3 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control"
        >
          Log a Visitor/Call
        </button>
      </div>

      <div className="mt-4 border border-zinc-300 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
          <h3 className="font-display text-base font-semibold text-zinc-900">
            Visitor log
          </h3>
        </div>

        {visitors.length === 0 ? (
          <p className="px-4 py-5 text-sm text-zinc-600 sm:px-5">
            No visitors logged yet.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {visitors.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-3 items-center gap-3 px-4 py-3 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {item.fullName}
                  </p>
                  {item.inquiryId ? (
                    <p className="mt-0.5 truncate text-xs text-emerald-700">
                      Inquiry, Sent to Admin Department
                    </p>
                  ) : null}
                </div>
                <p className="truncate text-center text-sm text-zinc-600">
                  {visitorPurposeLabel(item.purpose)}
                </p>
                <p className="truncate text-right text-sm text-zinc-500">
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
            className="max-h-[90vh] w-full max-w-lg overflow-auto border border-zinc-300 bg-white shadow-lg"
          >
            {createSuccess && createdItem ? (
              <>
                <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
                  <h3
                    id="visitor-log-title"
                    className="font-display text-base font-semibold text-zinc-900"
                  >
                    Visitor logged
                  </h3>
                </div>
                <div className="px-4 py-5 sm:px-5">
                  <div className="flex items-start gap-3 border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
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
                <div className="flex items-center justify-end border-t border-zinc-200 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="bg-header px-3 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={onSubmit}>
                <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
                  <h3
                    id="visitor-log-title"
                    className="font-display text-base font-semibold text-zinc-900"
                  >
                    Log a Visitor/Call
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600">
                    Record who visited or called and why.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[12px] font-medium text-zinc-700">
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
                      className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-zinc-700">
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
                      className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-zinc-700">
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
                      className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[12px] font-medium text-zinc-700">
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
                      className="border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-header"
                    >
                      {VISITOR_PURPOSES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    {form.purpose === "inquiry" ? (
                      <span className="text-xs text-zinc-500">
                        Inquiry purpose sends a starter inquiry to Admin.
                      </span>
                    ) : null}
                  </label>

                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[12px] font-medium text-zinc-700">
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
                      className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header"
                    />
                  </label>
                </div>

                {error ? (
                  <div className="border-t border-zinc-200 px-4 py-3 text-sm text-red-700 sm:px-5">
                    {error}
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={closeEditor}
                    disabled={pending}
                    className="border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-45"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending || !form.fullName.trim()}
                    className="bg-header px-3 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control disabled:cursor-not-allowed disabled:opacity-45"
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
