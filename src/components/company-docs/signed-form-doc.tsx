"use client";

import Link from "next/link";
import { Fact, LetterheadReminder } from "@/components/company-docs/where-used";
import { DocumentSplit } from "@/components/documents/document-split";
import { ApprovalFormSheet } from "@/components/forms/approval-form-sheet";
import { LeaveForm } from "@/components/leave/leave-form";
import { usePageTitle } from "@/components/providers/page-title-provider";
import {
  sampleFormAnswers,
  SAMPLE_EMPLOYEE,
  SAMPLE_RAISER,
} from "@/lib/company-docs/sample";
import type { SignedFormRow } from "@/lib/company-docs/types";
import type { CompanyLetterhead } from "@/lib/company-settings/types";
import {
  addDays,
  daysInclusive,
  durationInYearsAndMonths,
} from "@/lib/datetime/calendar";
import { FORM_DEFINITIONS, isFormType } from "@/lib/forms/definitions";
import { printedForm } from "@/lib/forms/print";
import type { ApprovalFormDocument } from "@/lib/forms/queries";
import type { SignoffState } from "@/lib/signoffs/chains";
import type { LeaveDocument } from "@/lib/vacation/types";

/**
 * One signed form under Company Docs: where it is raised, who signs it in
 * what order, and a sample of the form itself.
 */
export function SignedFormDoc({
  orgCode,
  form,
  company,
  today,
  canManageCompany,
}: {
  orgCode: string;
  form: SignedFormRow;
  company: CompanyLetterhead;
  /** The day the page was opened, for the sample's dates. */
  today: string;
  canManageCompany: boolean;
}) {
  usePageTitle(form.name);

  // The boxes as they print on a form nobody has signed yet.
  const signoffs: SignoffState = {
    steps: form.signers.map((signer) => ({
      label: signer.label,
      preparer: signer.preparer,
      expectedName: signer.name,
      signed: null,
    })),
    status: "pending",
    waitingFor: form.signers[0]?.label ?? null,
    canSign: false,
  };
  const createdAt = `${today}T08:00:00.000Z`;

  let sample: ApprovalFormDocument | null = null;
  if (isFormType(form.key)) {
    const definition = FORM_DEFINITIONS[form.key];
    const answers = sampleFormAnswers(form.key, today);
    const amount = definition.amount(answers);
    sample = {
      id: "sample",
      formType: form.key,
      referenceNo: form.numberExample ?? "",
      staffName: definition.aboutEmployee ? SAMPLE_EMPLOYEE.fullName : "",
      summary: "",
      amount: amount === null ? null : String(amount),
      status: "pending",
      createdAt,
      ...answers,
      company,
      employee: definition.aboutEmployee ? SAMPLE_EMPLOYEE : null,
      raisedBy: SAMPLE_RAISER,
      signoffs,
    };
  }

  const start = addDays(today, 14);
  const end = addDays(start, 13);
  const joinedOn = addDays(today, -1100);
  const leave: LeaveDocument = {
    id: "sample",
    staffId: "sample",
    staffName: SAMPLE_EMPLOYEE.fullName,
    staffJobTitle: SAMPLE_EMPLOYEE.jobTitle,
    startDate: start,
    endDate: end,
    returnDate: addDays(end, 1),
    dayCount: daysInclusive(start, end),
    leaveType: "annual",
    reason: "Family visit",
    status: "pending",
    createdAt,
    company,
    employee: {
      designation: SAMPLE_EMPLOYEE.jobTitle,
      department: "Workers",
      localContact: "050 555 0101",
      homeCountryContact: "",
      passportNumber: "",
      joinedOn,
      workingDuration: durationInYearsAndMonths(joinedOn, start),
      previousReturn: "",
    },
    jobHandledBy: "Rubel",
    leaveAvailableDays: 30,
    officeComments: "",
    signoffs,
  };

  return (
    <DocumentSplit
      backHref={`/${orgCode}/company-docs`}
      landscape={
        sample ? printedForm(sample).orientation === "landscape" : false
      }
      side={
        <section className="card flex flex-col">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              {form.name}
            </h2>
          </div>
          <div className="flex flex-col gap-5 px-4 py-4">
            <dl className="divide-y divide-slate-100">
              <Fact label="Raised in">
                <Link
                  href={form.raisedHref}
                  className="font-medium text-primary hover:underline"
                >
                  {form.raisedIn}
                </Link>
              </Fact>
              <Fact label="Number">
                {form.numberExample ? (
                  <span className="font-mono text-[13px]">
                    {form.numberExample}
                  </span>
                ) : (
                  "None"
                )}
              </Fact>
              <Fact label="So far">
                {form.raised} raised
                {form.waiting > 0
                  ? `, ${form.waiting} waiting for signatures`
                  : ""}
              </Fact>
            </dl>

            <div>
              <h3 className="border-b border-slate-200 pb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Signed by, in this order
              </h3>
              <ol className="mt-3 flex flex-col gap-2.5">
                {form.signers.map((signer, index) => (
                  <li key={`${signer.label}-${index}`} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600">
                      {index + 1}
                    </span>
                    <span className="min-w-0 text-sm">
                      <span className="block font-medium text-slate-900">
                        {signer.label}
                      </span>
                      <span className="block text-slate-600">
                        {signer.preparer
                          ? "Whoever raises the form"
                          : signer.name || "Nobody named yet"}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-slate-500">
                The signatures come from the{" "}
                <Link
                  href={`/${orgCode}/organization`}
                  className="font-medium text-primary hover:underline"
                >
                  Organization
                </Link>{" "}
                chart: every owner, and the positions this form calls for.
              </p>
            </div>

            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              The wording and the questions of this form are built in.
            </p>
          </div>
        </section>
      }
    >
      <p className="mb-3 text-sm text-slate-600 print:hidden">
        <span className="font-medium text-slate-900">Sample.</span> This is how
        it comes out before anyone has signed.
      </p>
      <LetterheadReminder
        orgCode={orgCode}
        company={company}
        canSet={canManageCompany}
      />
      {sample ? (
        <ApprovalFormSheet form={sample} />
      ) : (
        <LeaveForm leave={leave} />
      )}
    </DocumentSplit>
  );
}
