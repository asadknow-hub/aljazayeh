"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InquiriesListPanel } from "@/components/inquiries/inquiries-list-panel";
import { InvoiceQueuePanel } from "@/components/inquiries/invoice-queue-panel";
import { usePageTitle } from "@/components/providers/page-title-provider";
import {
  ADMIN_SECTIONS,
  type AdminSection,
} from "@/lib/departments/shell-sections";
import type { InquiryView } from "@/lib/inquiries/types";

type AdminClientProps = {
  org: { id: string; name: string; code: string };
  initialSection: AdminSection;
  inquiries: InquiryView[];
  invoiceQueue: InquiryView[];
};

export function AdminClient({
  org,
  initialSection,
  inquiries,
  invoiceQueue,
}: AdminClientProps) {
  usePageTitle("Admin");
  const router = useRouter();
  const [section, setSection] = useState<AdminSection>(initialSection);

  function selectSection(next: AdminSection) {
    setSection(next);
    router.replace(`/${org.code}/admin?section=${next}`, { scroll: false });
  }

  return (
    <main className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-start">
        <aside className="sticky top-12 z-10 flex h-[calc(100dvh-3rem)] w-44 shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white sm:w-56">
          <div className="border-b border-zinc-200 px-3 py-3">
            <p className="truncate font-display text-sm font-semibold text-zinc-900">
              Admin
            </p>
            <p className="mt-0.5 truncate text-xs text-zinc-500">{org.name}</p>
          </div>
          <nav className="flex flex-col gap-0.5 p-2 sm:p-3">
            {ADMIN_SECTIONS.map((item) => {
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
              detailBasePath={`/${org.code}/admin/inquiries`}
              allowCreate
            />
          ) : null}
          {section === "invoice" ? (
            <InvoiceQueuePanel
              departmentLabel="Admin"
              detailBasePath={`/${org.code}/admin/inquiries`}
              initialInquiries={invoiceQueue}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}
