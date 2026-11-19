"use client";

import type { ReactNode } from "react";
import { useBackTarget } from "@/components/providers/page-title-provider";
import { PrinterIcon } from "@/components/ui/icons";

/**
 * A document with what is done to it beside it: on the left the fields to
 * fill in, or where its approval stands; on the right the paper itself, as it
 * prints. Only the paper is printed.
 */
export function DocumentSplit({
  side,
  children,
  backHref,
  landscape = false,
  printLabel,
}: {
  side: ReactNode;
  children: ReactNode;
  /** The list this document belongs to, for the header's back button. */
  backHref: string;
  /** The paper is A4 on its side, so it is shown smaller to fit. */
  landscape?: boolean;
  /** What the print button says; no button while there is nothing to print. */
  printLabel?: string;
}) {
  useBackTarget(backHref);

  return (
    <main className="flex-1 p-4 sm:p-6 print:p-0">
      <div
        className={[
          "grid gap-5 print:block",
          landscape
            ? "xl:grid-cols-[22rem_minmax(0,1fr)]"
            : "xl:grid-cols-[24rem_minmax(0,1fr)]",
        ].join(" ")}
      >
        <aside className="flex flex-col gap-4 xl:sticky xl:top-16 xl:self-start print:hidden">
          {side}
        </aside>
        <div className="min-w-0">
          {printLabel ? (
            <div className="mb-3 flex justify-end print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-secondary btn-sm"
              >
                <PrinterIcon />
                {printLabel}
              </button>
            </div>
          ) : null}
          {/* A sideways sheet is shown smaller so it fits beside the fields;
              it always prints full size. */}
          <div
            className={[
              "overflow-x-auto print:overflow-visible print:[zoom:1]",
              landscape ? "xl:max-2xl:[zoom:0.72] 2xl:[zoom:0.95]" : "",
            ].join(" ")}
          >
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
