"use client";

import Link from "next/link";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { SignPanel } from "@/components/signoffs/sign-panel";
import type { ActionResult } from "@/lib/actions/result";
import type { SignoffDecision, SignoffState } from "@/lib/signoffs/chains";

/**
 * Controls above a signed document: back, print, and the signing box. Not
 * printed. `onSign` is the document's own server action.
 */
export function DocumentActions({
  title,
  backHref,
  landscape = false,
  signoffs,
  onSign,
}: {
  title: string;
  backHref: string;
  landscape?: boolean;
  signoffs: SignoffState;
  onSign: (input: {
    pin: string;
    decision: SignoffDecision;
    remarks: string;
  }) => Promise<ActionResult<unknown>>;
}) {
  usePageTitle(title);

  return (
    <div
      className={[
        "mx-auto mb-4 flex w-full flex-col gap-3 print:hidden",
        landscape ? "max-w-[297mm]" : "max-w-[210mm]",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <Link
          href={backHref}
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
      <SignPanel signoffs={signoffs} onSign={onSign} />
    </div>
  );
}
