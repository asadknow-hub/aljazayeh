"use client";

import Link from "next/link";
import { PlusIcon } from "@/components/ui/icons";
import { formatFriendlyDate } from "@/lib/datetime/format";
import {
  FORM_DEFINITIONS,
  formatAmount,
  type ApprovalFormView,
  type FormType,
} from "@/lib/forms/definitions";

const STATUS_LABEL: Record<ApprovalFormView["status"], string> = {
  pending: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
};

/**
 * The list of one kind of signed form, and the way in to raise a new one.
 * Used for every form in src/lib/forms/definitions.ts.
 */
export function FormsPanel({
  orgCode,
  formType,
  forms,
}: {
  orgCode: string;
  formType: FormType;
  forms: ApprovalFormView[];
}) {
  const definition = FORM_DEFINITIONS[formType];
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
        <Link
          href={`/${orgCode}/forms/new/${formType}`}
          className="btn btn-primary"
        >
          <PlusIcon />
          New {definition.itemLabel}
        </Link>
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
    </div>
  );
}
