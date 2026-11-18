"use client";

import { usePageTitle } from "@/components/providers/page-title-provider";
import {
  activityCategoryLabel,
  activityDayCountLabel,
  type StaffActivityLogView,
} from "@/lib/activity/types";
import { formatFriendlyDateTime } from "@/lib/datetime/format";

type AllLogsClientProps = {
  org: { id: string; name: string; code: string };
  initialLogs: StaffActivityLogView[];
};

const COLUMNS = [
  "Date / Time",
  "Staff",
  "Job title",
  "Category",
  "Action",
  "Summary",
  "Details",
  "Status",
  "Days",
] as const;

export function AllLogsClient({ org, initialLogs }: AllLogsClientProps) {
  usePageTitle("All Logs");

  return (
    <main className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="font-display text-xl font-semibold text-zinc-900">
          All Logs
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Linear activity history for every staff member in {org.name}.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto border border-zinc-400 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
        <table className="min-w-[72rem] w-full border-collapse text-left text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-zinc-100">
              {COLUMNS.map((column) => (
                <th
                  key={column}
                  className="border-b border-r border-zinc-300 px-3 py-2 font-semibold text-zinc-800 last:border-r-0"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {initialLogs.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="border-b border-zinc-200 px-3 py-8 text-center text-sm text-zinc-500"
                >
                  No activity logged yet.
                </td>
              </tr>
            ) : (
              initialLogs.map((item, index) => (
                <tr
                  key={item.id}
                  className={index % 2 === 0 ? "bg-white" : "bg-zinc-50/80"}
                >
                  <td className="whitespace-nowrap border-b border-r border-zinc-200 px-3 py-2 text-zinc-700">
                    {formatFriendlyDateTime(new Date(item.occurredAt))}
                  </td>
                  <td className="whitespace-nowrap border-b border-r border-zinc-200 px-3 py-2 font-medium text-zinc-900">
                    {item.staffName}
                  </td>
                  <td className="whitespace-nowrap border-b border-r border-zinc-200 px-3 py-2 text-zinc-700">
                    {item.staffJobTitle || "—"}
                  </td>
                  <td className="whitespace-nowrap border-b border-r border-zinc-200 px-3 py-2 text-zinc-700">
                    {activityCategoryLabel(item.category)}
                  </td>
                  <td className="whitespace-nowrap border-b border-r border-zinc-200 px-3 py-2 capitalize text-zinc-700">
                    {item.action.replaceAll("_", " ")}
                  </td>
                  <td className="border-b border-r border-zinc-200 px-3 py-2 text-zinc-800">
                    {item.summary}
                  </td>
                  <td className="max-w-[18rem] truncate border-b border-r border-zinc-200 px-3 py-2 text-zinc-600">
                    {item.details || "—"}
                  </td>
                  <td className="whitespace-nowrap border-b border-r border-zinc-200 px-3 py-2 capitalize text-zinc-700">
                    {item.status ? item.status.replaceAll("_", " ") : "—"}
                  </td>
                  <td className="whitespace-nowrap border-b border-zinc-200 px-3 py-2 text-zinc-700">
                    {activityDayCountLabel(item.dayCount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
