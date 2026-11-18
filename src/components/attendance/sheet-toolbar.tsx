"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePageTitle } from "@/components/providers/page-title-provider";
import {
  ATTENDANCE_GROUPS,
  type AttendanceGroup,
} from "@/lib/attendance/types";

/** Controls above the attendance sheet. Not printed. */
export function SheetToolbar({
  basePath,
  backHref,
  month,
  group,
}: {
  basePath: string;
  backHref: string;
  month: string;
  group: AttendanceGroup;
}) {
  usePageTitle("Attendance Sheet");
  const router = useRouter();

  const go = (next: { month?: string; group?: AttendanceGroup }) =>
    router.replace(
      `${basePath}?month=${next.month ?? month}&group=${next.group ?? group}`,
    );

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={backHref}
          className="btn btn-secondary"
        >
          Back
        </Link>
        <input
          type="month"
          value={month}
          onChange={(event) => {
            if (event.target.value) go({ month: event.target.value });
          }}
          aria-label="Month"
          className="field"
        />
        <div className="flex">
          {ATTENDANCE_GROUPS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => go({ group: item.key })}
              className={[
                "border px-3 py-1.5 text-sm font-medium transition rounded-lg",
                item.key === group
                  ? "border-primary bg-primary text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => window.print()}
        className="btn btn-primary"
      >
        Print
      </button>
    </div>
  );
}
