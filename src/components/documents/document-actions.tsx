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
          className="btn btn-secondary"
        >
          Back
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="btn btn-primary"
        >
          Print
        </button>
      </div>
      <SignPanel signoffs={signoffs} onSign={onSign} />
    </div>
  );
}
