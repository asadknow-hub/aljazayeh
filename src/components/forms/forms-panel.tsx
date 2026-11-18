"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { unwrap } from "@/lib/actions/result";
import { formatFriendlyDate } from "@/lib/datetime/format";
import { createApprovalFormAction } from "@/lib/forms/actions";
import {
  FORM_DEFINITIONS,
  formatAmount,
  type ApprovalFormView,
  type FormField,
  type FormType,
} from "@/lib/forms/definitions";
import type { StaffOption } from "@/lib/staff/types";

const inputClass =
  "field w-full";
const labelClass = "field-label";

const STATUS_LABEL: Record<ApprovalFormView["status"], string> = {
  pending: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
};

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === "longtext") {
    return (
      <textarea
        rows={3}
        required={field.required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    );
  }
  const numeric = field.type === "amount" || field.type === "number";
  return (
    <input
      type={field.type === "date" ? "date" : "text"}
      inputMode={numeric ? "decimal" : undefined}
      required={field.required}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
    />
  );
}

/**
 * The list of one kind of signed form, with the dialog to raise a new one.
 * Used for every form in src/lib/forms/definitions.ts.
 */
export function FormsPanel({
  orgCode,
  formType,
  forms,
  staffOptions = [],
}: {
  orgCode: string;
  formType: FormType;
  forms: ApprovalFormView[];
  /** Needed for forms about an employee. */
  staffOptions?: StaffOption[];
}) {
  const definition = FORM_DEFINITIONS[formType];
  const router = useRouter();

  const emptyFields = () =>
    Object.fromEntries(
      definition.fields.map((field) => [field.key, field.defaultValue ?? ""]),
    );
  const emptyLine = () =>
    Object.fromEntries(
      definition.lineColumns.map((column) => [column.key, ""]),
    );

  const [editorOpen, setEditorOpen] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [fields, setFields] = useState(emptyFields);
  const [lines, setLines] = useState(() => [emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const amount = definition.amount({ fields, lines });
  const activeStaff = staffOptions.filter((item) => item.status === "active");

  function openEditor() {
    setStaffId("");
    setFields(emptyFields());
    setLines([emptyLine()]);
    setError(null);
    setEditorOpen(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const created = await unwrap(
        createApprovalFormAction(orgCode, formType, { staffId, fields, lines }),
      );
      // Straight to the form, where the signatures are collected.
      router.push(`/${orgCode}/forms/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            {definition.listLabel}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Raise a {definition.itemLabel} and follow its approval.
          </p>
        </div>
        <button
          type="button"
          onClick={openEditor}
          className="btn btn-primary"
        >
          New {definition.itemLabel}
        </button>
      </div>

      <div className="card mt-4">
        {forms.length === 0 ? (
          <p className="px-4 py-5 text-sm text-slate-600 sm:px-5">
            Nothing here yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {forms.map((form) => (
              <li key={form.id}>
                <Link
                  href={`/${orgCode}/forms/${form.id}`}
                  className="flex flex-col gap-1 px-4 py-3 transition hover:bg-slate-50 sm:flex-row sm:items-start sm:justify-between sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">
                      {form.summary}
                      {form.amount ? ` · AED ${formatAmount(form.amount)}` : ""}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {form.referenceNo} ·{" "}
                      {formatFriendlyDate(new Date(form.createdAt))}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-slate-700">
                    {STATUS_LABEL[form.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <form
            onSubmit={onSubmit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-form-title"
            className="card max-h-[90vh] w-full max-w-5xl overflow-auto shadow-lg"
          >
            <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
              <h3
                id="new-form-title"
                className="font-display text-base font-semibold text-slate-900"
              >
                New {definition.itemLabel}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                After saving, the form goes round for signatures.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
              {definition.aboutEmployee ? (
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className={labelClass}>Employee</span>
                  <select
                    required
                    value={staffId}
                    onChange={(event) => setStaffId(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select an employee</option>
                    {activeStaff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.fullName}
                        {staff.jobTitle ? ` · ${staff.jobTitle}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {definition.fields.map((field) => (
                <label
                  key={field.key}
                  className={[
                    "flex flex-col gap-1.5",
                    field.type === "longtext" ? "sm:col-span-2" : "",
                  ].join(" ")}
                >
                  <span className={labelClass}>{field.label}</span>
                  <FieldInput
                    field={field}
                    value={fields[field.key] ?? ""}
                    onChange={(value) =>
                      setFields((current) => ({
                        ...current,
                        [field.key]: value,
                      }))
                    }
                  />
                </label>
              ))}
            </div>

            {definition.lineColumns.length > 0 ? (
              <div className="border-t border-slate-200 px-4 py-4 sm:px-5">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[52rem] border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="w-8 border border-slate-300 bg-slate-100 px-2 py-1.5 text-left text-xs font-medium">
                          SN
                        </th>
                        {definition.lineColumns.map((column) => (
                          <th
                            key={column.key}
                            className="border border-slate-300 bg-slate-100 px-2 py-1.5 text-left text-xs font-medium"
                          >
                            {column.label}
                          </th>
                        ))}
                        <th className="w-8 border border-slate-300 bg-slate-100" />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, index) => (
                        <tr key={index}>
                          <td className="border border-slate-300 px-2 text-xs text-slate-600">
                            {index + 1}
                          </td>
                          {definition.lineColumns.map((column) => (
                            <td
                              key={column.key}
                              className="border border-slate-300"
                            >
                              <input
                                aria-label={`${column.label}, line ${index + 1}`}
                                value={line[column.key] ?? ""}
                                onChange={(event) =>
                                  setLines((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            [column.key]: event.target.value,
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                className="w-full bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-slate-50"
                              />
                            </td>
                          ))}
                          <td className="border border-slate-300 text-center">
                            <button
                              type="button"
                              aria-label={`Remove line ${index + 1}`}
                              disabled={lines.length === 1}
                              onClick={() =>
                                setLines((current) =>
                                  current.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                )
                              }
                              className="px-2 text-slate-500 hover:text-red-700 disabled:opacity-30"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setLines((current) => [...current, emptyLine()])
                  }
                  className="btn btn-secondary btn-sm mt-2"
                >
                  Add line
                </button>
              </div>
            ) : null}

            {amount !== null ? (
              <p className="border-t border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 sm:px-5">
                Total: AED {formatAmount(amount)}
              </p>
            ) : null}
            {error ? (
              <p
                className="border-t border-slate-200 px-4 py-3 text-sm text-red-700 sm:px-5"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 sm:px-5">
              <button
                type="button"
                disabled={pending}
                onClick={() => setEditorOpen(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="btn btn-primary"
              >
                {pending ? "Saving…" : "Save and send for signatures"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
