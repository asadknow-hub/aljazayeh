"use client";

import Link from "next/link";
import { formatFriendlyDate } from "@/lib/datetime/format";
import { inquiryStageLabel } from "@/lib/inquiries/stages";
import type { InquiryView } from "@/lib/inquiries/types";

type InvoiceQueuePanelProps = {
  departmentLabel: string;
  detailBasePath: string;
  initialInquiries: InquiryView[];
};

export function InvoiceQueuePanel({
  departmentLabel,
  detailBasePath,
  initialInquiries,
}: InvoiceQueuePanelProps) {
  return (
    <div className="w-full max-w-5xl">
      <div>
        <h2 className="font-display text-xl font-semibold text-zinc-900">
          Invoice
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Invoice-related inquiry stages currently mapped to {departmentLabel}.
          Unassigned items wait in this queue until someone is assigned.
        </p>
      </div>

      <div className="mt-4 border border-zinc-300 bg-white">
        {initialInquiries.length === 0 ? (
          <p className="px-4 py-5 text-sm text-zinc-600 sm:px-5">
            No invoice-stage inquiries for this department right now.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {initialInquiries.map((item) => (
              <li key={item.id}>
                <Link
                  href={`${detailBasePath}/${item.id}`}
                  className="flex flex-col gap-1 px-4 py-3 transition hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {item.customerName}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {item.assignedStaffName
                        ? `Assigned: ${item.assignedStaffName}`
                        : "Unassigned — pick from inquiry"}
                      {item.deliveryExpectedOn
                        ? ` · Due ${formatFriendlyDate(item.deliveryExpectedOn)}`
                        : ""}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-zinc-600">
                    {inquiryStageLabel(item.currentStage)}
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
