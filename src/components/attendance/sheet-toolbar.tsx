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
          className="border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
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
          className="border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-header"
        />
        <div className="flex">
          {ATTENDANCE_GROUPS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => go({ group: item.key })}
              className={[
                "border px-3 py-1.5 text-sm font-medium transition",
                item.key === group
                  ? "border-header bg-header text-header-fg"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
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
        className="bg-header px-4 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control"
      >
        Print
      </button>
    </div>
  );
}
