"use client";

import Link from "next/link";
import {
  approverLabel,
  countLabel,
  stepPlace,
  whenPrepared,
} from "@/components/company-docs/where-used";
import { DepartmentChip } from "@/components/inquiries/inquiry-chips";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { ArrowRightIcon, DocumentIcon } from "@/components/ui/icons";
import type {
  CompanyDocRow,
  CompanyDocsOverview,
} from "@/lib/company-docs/types";
import { formatFriendlyDate } from "@/lib/datetime/format";

const rowLink =
  "group flex flex-col gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-slate-50 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_12rem_5.5rem_12rem_1.25rem] lg:items-center";

function VersionNote({ doc }: { doc: CompanyDocRow }) {
  if (doc.version === 0) {
    return <span className="text-xs text-slate-500">As built in</span>;
  }
  return (
    <span className="text-xs text-blue-800">
      <span className="chip bg-blue-50 text-blue-800 ring-1 ring-blue-200 ring-inset">
        Changed
      </span>{" "}
      {formatFriendlyDate(new Date(doc.changedAt!))}
      {doc.changedByName ? ` · ${doc.changedByName}` : ""}
    </span>
  );
}

/**
 * Company Docs: every paper the company prepares, where it is used, who
 * prepares it, and the way in to change it.
 */
export function CompanyDocsClient({
  orgCode,
  overview,
}: {
  orgCode: string;
  overview: CompanyDocsOverview;
}) {
  usePageTitle("Company Docs");

  return (
    <main className="flex-1 p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Company Docs
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Every paper the company prepares: the step it belongs to, who
            prepares it and how it is numbered.{" "}
            {overview.canEdit
              ? "Open one to change its wording, what it asks for, or the code in its numbers."
              : "Open one to see it."}
          </p>
        </header>

        <section>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Inquiry process
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            A job goes through these steps in order. Each step prepares its
            papers from the steps before it.
          </p>
          <ol className="mt-3 flex flex-col gap-3">
            {overview.steps.map((step) => {
              const place = stepPlace(step);
              return (
                <li key={step.stage} className="card overflow-hidden">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 sm:px-5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                      {place.number}
                    </span>
                    <h3 className="font-display text-base font-semibold text-slate-900">
                      {step.label}
                    </h3>
                    <DepartmentChip department={step.departmentKey} />
                    {step.approvalBy ? (
                      <span className="chip bg-amber-50 text-amber-900 ring-1 ring-amber-200 ring-inset">
                        Approved by {approverLabel(step.approvalBy)}
                      </span>
                    ) : null}
                    {place.note ? (
                      <span className="text-xs text-slate-500">
                        {place.note}
                      </span>
                    ) : null}
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {step.docs.map((doc) => (
                      <li key={doc.document}>
                        <Link
                          href={`/${orgCode}/company-docs/steps/${doc.stage}/${doc.document}`}
                          className={rowLink}
                        >
                          <span className="flex min-w-0 items-start gap-2.5">
                            <DocumentIcon
                              className={`mt-0.5 h-4 w-4 shrink-0 ${doc.kind === "paper" ? "text-primary" : "text-slate-400"}`}
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-slate-900">
                                {doc.name}
                              </span>
                              <span className="block text-xs text-slate-500">
                                {doc.kind === "details"
                                  ? "Asked on screen; not a paper"
                                  : whenPrepared(doc.onlyWhen)}
                              </span>
                            </span>
                          </span>
                          <span className="font-mono text-xs text-slate-600">
                            {doc.numberExample ?? ""}
                          </span>
                          <span className="text-xs text-slate-600">
                            {countLabel(doc.used, "job")}
                          </span>
                          <VersionNote doc={doc} />
                          <ArrowRightIcon className="hidden h-4 w-4 text-slate-400 transition-colors group-hover:text-primary lg:block" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Signed forms
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Raised by one person, then signed in order by the people named.
          </p>
          <ul className="card mt-3 divide-y divide-slate-100 overflow-hidden">
            {overview.forms.map((form) => (
              <li key={form.key}>
                <Link
                  href={`/${orgCode}/company-docs/forms/${form.key}`}
                  className={rowLink}
                >
                  <span className="flex min-w-0 items-start gap-2.5">
                    <DocumentIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">
                        {form.name}
                      </span>
                      <span className="block text-xs text-slate-500">
                        Raised in {form.raisedIn} · signed by{" "}
                        {form.signers.map((signer) => signer.label).join(" → ")}
                      </span>
                    </span>
                  </span>
                  <span className="font-mono text-xs text-slate-600">
                    {form.numberExample ?? ""}
                  </span>
                  <span className="text-xs text-slate-600">
                    {form.raised} raised
                  </span>
                  <span className="text-xs text-slate-600">
                    {form.waiting > 0
                      ? `${form.waiting} waiting for signatures`
                      : ""}
                  </span>
                  <ArrowRightIcon className="hidden h-4 w-4 text-slate-400 transition-colors group-hover:text-primary lg:block" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
