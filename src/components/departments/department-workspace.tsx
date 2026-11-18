"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InquiriesListPanel } from "@/components/inquiries/inquiries-list-panel";
import { InvoiceQueuePanel } from "@/components/inquiries/invoice-queue-panel";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { FormsPanel } from "@/components/forms/forms-panel";
import {
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
import type { InquiryView } from "@/lib/inquiries/types";

type DepartmentWorkspaceProps = {
  org: { name: string; code: string };
  departmentKey: InquiryWorkflowDepartmentKey;
  initialSection: DepartmentSection;
  inquiries: InquiryView[];
  invoiceQueue: InquiryView[];
  /** The forms this department raises, by kind. */
  forms: Partial<Record<FormType, ApprovalFormView[]>>;
};

export function DepartmentWorkspace({
  org,
  departmentKey,
  initialSection,
  inquiries,
  invoiceQueue,
  forms,
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
        <aside className="sticky top-12 z-10 flex h-[calc(100dvh-3rem)] w-44 shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white sm:w-56">
          <div className="border-b border-zinc-200 px-3 py-3">
            <p className="truncate font-display text-sm font-semibold text-zinc-900">
              {label}
            </p>
            <p className="mt-0.5 truncate text-xs text-zinc-500">{org.name}</p>
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
                    "px-3 py-2 text-left text-sm transition",
                    active
                      ? "bg-header text-header-fg"
                      : "text-zinc-700 hover:bg-zinc-100",
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
              detailBasePath={`${basePath}/inquiries`}
              allowCreate={departmentKey === "admin"}
            />
          ) : null}
          {section === "invoice" ? (
            <InvoiceQueuePanel
              departmentLabel={label}
              detailBasePath={`${basePath}/inquiries`}
              initialInquiries={invoiceQueue}
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
        </div>
      </div>
    </main>
  );
}
