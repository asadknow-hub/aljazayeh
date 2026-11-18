"use client";

import Link from "next/link";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { SignPanel } from "@/components/signoffs/sign-panel";
import type { SignoffState } from "@/lib/signoffs/chains";
import { signVacationRequestAction } from "@/lib/vacation/actions";

/** Controls above a leave form: back, print, and the signing box. Not printed. */
export function LeaveActions({
  orgCode,
  requestId,
  signoffs,
}: {
  orgCode: string;
  requestId: string;
  signoffs: SignoffState;
}) {
  usePageTitle("Leave Request");

  return (
    <div className="mx-auto mb-4 flex w-full max-w-[210mm] flex-col gap-3 print:hidden">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/${orgCode}`}
          className="border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
        >
          Back
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="bg-header px-4 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control"
        >
          Print
        </button>
      </div>
      <SignPanel
        signoffs={signoffs}
        onSign={(input) => signVacationRequestAction(orgCode, requestId, input)}
      />
    </div>
  );
}
