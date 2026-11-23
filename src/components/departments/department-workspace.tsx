"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InquiriesListPanel } from "@/components/inquiries/inquiries-list-panel";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { BankAccountsPanel } from "@/components/banks/bank-accounts-panel";
import { FormsPanel } from "@/components/forms/forms-panel";
import type { BankAccount } from "@/lib/banks/types";
import {
  BANKS_SECTION,
  departmentSections,
  type DepartmentSection,
} from "@/lib/departments/sections";
import {
  isFormType,
  type ApprovalFormView,
  type FormType,
} from "@/lib/forms/definitions";
import {
  workflowDepartmentLabel,
  type InquiryWorkflowDepartmentKey,
} from "@/lib/inquiries/stages";
import type { StepTemplate } from "@/lib/inquiries/stage-forms";
import type {
  AssignableStaff,
  InquirySummary,
} from "@/lib/inquiries/types";

type DepartmentWorkspaceProps = {
  org: { name: string; code: string };
  departmentKey: InquiryWorkflowDepartmentKey;
  initialSection: DepartmentSection;
  inquiries: InquirySummary[];
  myStaffId: string;
  assignable: Partial<Record<InquiryWorkflowDepartmentKey, AssignableStaff[]>>;
  /** What the company asks for on a new inquiry. */
  inquiryTemplate: StepTemplate;
  /** The forms this department raises, by kind. */
  forms: Partial<Record<FormType, ApprovalFormView[]>>;
  /** The company's bank accounts; only Accounts keeps them. */
  bankAccounts: BankAccount[];
};

export function DepartmentWorkspace({
  org,
  departmentKey,
  initialSection,
  inquiries,
  myStaffId,
  assignable,
  inquiryTemplate,
  forms,
  bankAccounts,
}: DepartmentWorkspaceProps) {
  const label = workflowDepartmentLabel(departmentKey);
  const basePath = `/${org.code}/${departmentKey}`;

  usePageTitle(label);
  const router = useRouter();
  const [section, setSection] = useState<DepartmentSection>(initialSection);

  function selectSection(next: DepartmentSection) {
    setSection(next);
    router.replace(`${basePath}?section=${next}`, { scroll: false });
  }

  return (
    <main className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-start">
        <aside className="sticky top-12 z-10 flex h-[calc(100dvh-3rem)] w-44 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white sm:w-56">
          <div className="border-b border-slate-200 px-3 py-3">
            <p className="truncate font-display text-sm font-semibold text-slate-900">
              {label}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{org.name}</p>
          </div>
          <nav className="flex flex-col gap-0.5 p-2 sm:p-3">
            {departmentSections(departmentKey).map((item) => {
              const active = item.key === section;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => selectSection(item.key)}
                  className={[
                    "cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-primary text-white"
                      : "text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0 flex-1 p-4 sm:p-6">
          {section === "inquiries" ? (
            <InquiriesListPanel
              orgCode={org.code}
              initialInquiries={inquiries}
              detailHref={(inquiry) => `${basePath}/inquiries/${inquiry.id}`}
              description={
                departmentKey === "admin"
                  ? "Every job, from the first request to payment."
                  : `Jobs whose current step is handled by ${label}.`
              }
              allowCreate={departmentKey === "admin"}
              myStaffId={myStaffId}
              assignable={assignable}
              inquiryTemplate={inquiryTemplate}
            />
          ) : null}
          {isFormType(section) ? (
            <FormsPanel
              key={section}
              orgCode={org.code}
              formType={section}
              forms={forms[section] ?? []}
            />
          ) : null}
          {section === BANKS_SECTION ? (
            <BankAccountsPanel orgCode={org.code} initialAccounts={bankAccounts} />
          ) : null}
        </div>
      </div>
    </main>
  );
}
