"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AttendancePanel } from "@/app/(app)/[orgCode]/reception/attendance-panel";
import { LeavePanel } from "@/app/(app)/[orgCode]/reception/leave-panel";
import { VisitorsPanel } from "@/app/(app)/[orgCode]/reception/visitors-panel";
import { FormsPanel } from "@/components/forms/forms-panel";
import { usePageTitle } from "@/components/providers/page-title-provider";
import type { AttendanceDay } from "@/lib/attendance/types";
import {
  isFormType,
  type ApprovalFormView,
  type FormType,
} from "@/lib/forms/definitions";
import {
  RECEPTION_SECTIONS,
  type ReceptionSection,
} from "@/lib/reception/sections";
import type { StaffOption } from "@/lib/staff/types";
import type { VacationRequestView } from "@/lib/vacation/types";
import type { VisitorLogView } from "@/lib/visitors/types";

type ReceptionClientProps = {
  org: { name: string; code: string };
  staffOptions: StaffOption[];
  initialVacations: VacationRequestView[];
  initialVisitors: VisitorLogView[];
  /** The forms Reception raises, by kind. */
  forms: Partial<Record<FormType, ApprovalFormView[]>>;
  initialAttendance: AttendanceDay;
  /** Today's date in Dubai. */
  today: string;
  initialSection: ReceptionSection;
};

export function ReceptionClient({
  org,
  staffOptions,
  initialVacations,
  initialVisitors,
  forms,
  initialAttendance,
  today,
  initialSection,
}: ReceptionClientProps) {
  usePageTitle("Reception");
  const router = useRouter();
  const [section, setSection] = useState<ReceptionSection>(initialSection);

  function selectSection(next: ReceptionSection) {
    setSection(next);
    router.replace(`/${org.code}/reception?section=${next}`, { scroll: false });
  }

  return (
    <main className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-start">
        <aside className="sticky top-12 z-10 flex h-[calc(100dvh-3rem)] w-44 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white sm:w-56">
          <div className="border-b border-slate-200 px-3 py-3">
            <p className="truncate font-display text-sm font-semibold text-slate-900">
              Reception
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{org.name}</p>
          </div>
          <nav className="flex flex-col gap-0.5 p-2 sm:p-3">
            {RECEPTION_SECTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => selectSection(item.key)}
                className={[
                  "cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  item.key === section
                    ? "bg-primary text-white"
                    : "text-slate-700 hover:bg-slate-100",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 p-4 sm:p-6">
          {section === "attendance" ? (
            <AttendancePanel
              orgCode={org.code}
              today={today}
              initialDay={initialAttendance}
            />
          ) : null}
          {section === "vacation" ? (
            <LeavePanel
              orgCode={org.code}
              today={today}
              staffOptions={staffOptions}
              requests={initialVacations}
            />
          ) : null}
          {section === "visitors" ? (
            <VisitorsPanel
              orgCode={org.code}
              initialVisitors={initialVisitors}
            />
          ) : null}
          {isFormType(section) ? (
            <FormsPanel
              key={section}
              orgCode={org.code}
              formType={section}
              forms={forms[section] ?? []}
              staffOptions={staffOptions}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}
