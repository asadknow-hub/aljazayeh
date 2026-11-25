"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DocumentSplit } from "@/components/documents/document-split";
import { ApprovalFormSheet } from "@/components/forms/approval-form-sheet";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { useToast } from "@/components/providers/toast-provider";
import {
  AlertIcon,
  ArrowRightIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { unwrap } from "@/lib/actions/result";
import { firstApprover } from "@/lib/signoffs/chains";
import { createApprovalFormAction } from "@/lib/forms/actions";
import {
  FORM_DEFINITIONS,
  formatAmount,
  type FormField,
  type FormType,
} from "@/lib/forms/definitions";
import { hoursBetween } from "@/lib/forms/overtime";
import { printedForm } from "@/lib/forms/print";
import type {
  ApprovalFormDocument,
  FormDraftContext,
} from "@/lib/forms/queries";

function FieldInput({
  field,
  value,
  onChange,
  employees = [],
}: {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  /** The people an "employee" answer is chosen from. */
  employees?: FormDraftContext["employees"];
}) {
  if (field.type === "employee") {
    return (
      <select
        required={field.required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field w-full"
      >
        <option value="">Select an employee</option>
        {employees.map((item) => (
          <option key={item.id} value={item.id}>
            {item.fullName}
            {item.employeeCode ? ` · ${item.employeeCode}` : ""}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "longtext") {
    return (
      <textarea
        rows={3}
        required={field.required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field w-full"
      />
    );
  }
  const numeric = field.type === "amount" || field.type === "number";
  return (
    <input
      type={
        field.type === "date" ? "date" : field.type === "time" ? "time" : "text"
      }
      inputMode={numeric ? "decimal" : undefined}
      required={field.required}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="field w-full"
    />
  );
}

function FieldLabel({ field }: { field: FormField }) {
  return (
    <span className="field-label">
      {field.label}
      {field.required ? <span className="ml-0.5 text-red-600">*</span> : null}
    </span>
  );
}

/** Short fields sit two to a row; anything wordy takes the full width. */
const isWide = (field: FormField) =>
  field.type === "longtext" ||
  field.type === "text" ||
  field.type === "employee";

/**
 * A new signed form: what is asked on the left, the form itself filling in on
 * the right. Sending it starts the round of approvals. Used for every form
 * in src/lib/forms/definitions.ts.
 */
export function FormEditor({
  orgCode,
  formType,
  context,
  now,
  listHref,
}: {
  orgCode: string;
  formType: FormType;
  context: FormDraftContext;
  /** The moment the page was opened, as the form's date. */
  now: string;
  listHref: string;
}) {
  const definition = FORM_DEFINITIONS[formType];
  usePageTitle(`New ${definition.title}`);
  const router = useRouter();
  const { showToast } = useToast();

  const emptyLine = () =>
    Object.fromEntries(
      definition.lineColumns.map((column) => [column.key, ""]),
    );
  const [staffId, setStaffId] = useState("");
  const [fields, setFields] = useState(() =>
    Object.fromEntries(
      definition.fields.map((field) => [field.key, field.defaultValue ?? ""]),
    ),
  );
  const [lines, setLines] = useState(() => [emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const amount = definition.amount({ fields, lines });
  const employee = context.employees.find((item) => item.id === staffId);
  const preview: ApprovalFormDocument = {
    id: "",
    formType,
    referenceNo: "",
    staffName: employee?.fullName ?? "",
    summary: "",
    amount: amount === null ? null : String(amount),
    status: "pending",
    createdAt: now,
    fields,
    lines,
    company: context.company,
    employee: employee
      ? { fullName: employee.fullName, jobTitle: employee.jobTitle }
      : null,
    raisedBy: context.raisedBy,
    signoffs: context.signoffs,
  };
  const approver = firstApprover(context.signoffs.steps);

  const setLine = (index: number, column: FormField, value: string) =>
    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const next = { ...line, [column.key]: value };
        // The form beside it shows the person by name and employee ID.
        if (column.type === "employee") {
          const person = context.employees.find((item) => item.id === value);
          next.name = person?.fullName ?? "";
          next.employeeId = person?.employeeCode ?? "";
        }
        // Overtime: the hours follow the start and end time.
        if (
          formType === "overtime" &&
          (column.key === "startTime" || column.key === "endTime")
        ) {
          const hours = hoursBetween(next.startTime ?? "", next.endTime ?? "");
          if (hours) next.hours = hours;
        }
        return next;
      }),
    );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const created = await unwrap(
        createApprovalFormAction(orgCode, formType, { staffId, fields, lines }),
      );
      showToast("Sent for approval");
      // Replaces this page, so going back does not return to a used form.
      router.replace(`/${orgCode}/forms/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send it.");
      setPending(false);
    }
  }

  return (
    <DocumentSplit
      backHref={listHref}
      landscape={printedForm(preview).orientation === "landscape"}
      side={
        // Never taller than the screen: the fields scroll inside the card, so
        // its heading and its buttons stay in view.
        <form
          onSubmit={onSubmit}
          className="card flex flex-col xl:max-h-[calc(100dvh-5rem)]"
        >
          <div className="shrink-0 border-b border-slate-200 px-4 py-3">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              New {definition.itemLabel}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Fill in here. The form beside it fills in as you type, and gets
              its number when you send it.
            </p>
          </div>

          <div className="min-h-0 overflow-y-auto">
            <div className="grid grid-cols-2 gap-x-3 gap-y-3.5 px-4 py-4">
              {definition.aboutEmployee ? (
                <label className="col-span-2 flex flex-col gap-1.5">
                  <span className="field-label">
                    Employee<span className="ml-0.5 text-red-600">*</span>
                  </span>
                  <select
                    required
                    value={staffId}
                    onChange={(event) => setStaffId(event.target.value)}
                    className="field w-full"
                  >
                    <option value="">Select an employee</option>
                    {context.employees.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.fullName}
                        {item.jobTitle ? ` · ${item.jobTitle}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {definition.fields.map((field) => (
                <label
                  key={field.key}
                  className={`flex flex-col gap-1.5 ${isWide(field) ? "col-span-2" : ""}`}
                >
                  <FieldLabel field={field} />
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
              <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4">
                <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Lines
                </h3>
                {lines.map((line, index) => (
                  <fieldset
                    key={index}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                  >
                    <legend className="sr-only">Line {index + 1}</legend>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="chip bg-slate-200 text-slate-700">
                        Line {index + 1}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove line ${index + 1}`}
                        title="Remove this line"
                        disabled={lines.length === 1}
                        onClick={() =>
                          setLines((current) =>
                            current.filter(
                              (_, lineIndex) => lineIndex !== index,
                            ),
                          )
                        }
                        className="cursor-pointer rounded-md p-1 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-default disabled:opacity-30"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                      {definition.lineColumns.map((column) => (
                        <label
                          key={column.key}
                          className={`flex flex-col gap-1 ${isWide(column) ? "col-span-2" : ""}`}
                        >
                          <FieldLabel field={column} />
                          <FieldInput
                            field={column}
                            value={line[column.key] ?? ""}
                            employees={context.employees}
                            onChange={(value) => setLine(index, column, value)}
                          />
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setLines((current) => [...current, emptyLine()])
                  }
                  className="btn btn-secondary btn-sm self-start"
                >
                  <PlusIcon />
                  Add another line
                </button>
                {definition.linesNote ? (
                  <p className="text-xs text-slate-500">
                    {definition.linesNote}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {amount !== null ? (
            <p className="flex shrink-0 items-baseline justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              Total
              <span className="font-display text-lg font-semibold text-slate-900">
                AED {formatAmount(amount)}
              </span>
            </p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}

          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
            <Link href={listHref} className="btn btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary !items-center !py-1.5 text-left"
            >
              <span className="flex flex-col leading-tight">
                <span>{pending ? "Sending…" : "Send for Approval"}</span>
                {approver ? (
                  <span className="text-xs font-normal text-blue-100">
                    Goes to {approver.expectedName || approver.label}
                  </span>
                ) : null}
              </span>
              <ArrowRightIcon className="h-5 w-5" />
            </button>
          </div>
        </form>
      }
    >
      <ApprovalFormSheet form={preview} />
    </DocumentSplit>
  );
}
