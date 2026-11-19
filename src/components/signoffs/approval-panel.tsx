"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { useToast } from "@/components/providers/toast-provider";
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
} from "@/components/ui/icons";
import { unwrap, type ActionResult } from "@/lib/actions/result";
import { formatFriendlyDateTime } from "@/lib/datetime/format";
import type { SignoffDecision, SignoffState } from "@/lib/signoffs/chains";

type SignInput = { pin: string; decision: SignoffDecision; remarks: string };

/**
 * Where a signed document stands: who has approved it, whose turn it is, and
 * for the person whose turn it is, the box to approve or reject it with
 * their PIN. `onSign` is the document's own server action.
 */
export function ApprovalPanel({
  title,
  reference,
  signoffs,
  onSign,
}: {
  title: string;
  /** Which one it is: its number, or who and when. */
  reference: string;
  signoffs: SignoffState;
  onSign: (input: SignInput) => Promise<ActionResult<unknown>>;
}) {
  usePageTitle(title);
  const router = useRouter();
  const { showToast } = useToast();
  const [pin, setPin] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function sign(decision: SignoffDecision) {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await unwrap(onSign({ pin, decision, remarks }));
      setPin("");
      setRemarks("");
      showToast(decision === "approved" ? "Approved and signed" : "Rejected");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign.");
    } finally {
      setPending(false);
    }
  }

  const rejection = signoffs.steps.find(
    (step) => step.signed?.decision === "rejected",
  )?.signed;
  const nextIndex = signoffs.steps.findIndex((step) => !step.signed);
  const next = signoffs.status === "pending" ? signoffs.steps[nextIndex] : null;

  // Written out in full so the stylesheet includes them.
  const tone =
    signoffs.status === "approved"
      ? "!border-emerald-300 !bg-emerald-50"
      : signoffs.status === "rejected"
        ? "!border-red-300 !bg-red-50"
        : signoffs.canSign
          ? "!border-amber-300 !bg-amber-50"
          : "!border-blue-200 !bg-primary-soft";

  return (
    <>
      <section className={`card p-4 ${tone}`}>
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          {title}
        </p>
        <p className="text-sm font-medium text-slate-700">{reference}</p>
        <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">
          {signoffs.status === "approved"
            ? "Approved"
            : signoffs.status === "rejected"
              ? `Rejected by ${rejection?.name}`
              : signoffs.canSign
                ? "Waiting for your approval"
                : "Sent for approval"}
        </h2>
        <p className="mt-0.5 text-sm text-slate-700">
          {signoffs.status === "approved"
            ? "Everyone has signed. It can be printed."
            : signoffs.status === "rejected"
              ? rejection?.remarks
                ? `Reason: ${rejection.remarks}`
                : "It goes no further."
              : signoffs.canSign
                ? "Check the form beside this, then approve or reject it."
                : `Waiting for ${next?.label}${next?.expectedName ? ` (${next.expectedName})` : ""}. Nothing more to do here until then.`}
        </p>

        {signoffs.canSign ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-amber-200 pt-4">
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Your approval PIN</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={pin}
                onChange={(event) =>
                  setPin(event.target.value.replace(/\D/g, ""))
                }
                className="field w-32"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="field-label">
                Remarks (needed if you reject)
              </span>
              <input
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                className="field"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || pin.length < 4}
                onClick={() => sign("approved")}
                className="btn btn-go"
              >
                <CheckIcon />
                Approve and sign
              </button>
              <button
                type="button"
                disabled={pending || pin.length < 4}
                onClick={() => sign("rejected")}
                className="btn btn-danger"
              >
                Reject
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Approving places your saved signature on the form.
            </p>
            {error ? (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="card p-4">
        <h3 className="text-sm font-semibold text-slate-900">Approvals</h3>
        <ol className="mt-3 flex flex-col gap-3">
          {signoffs.steps.map((step, index) => {
            const rejected = step.signed?.decision === "rejected";
            const current =
              signoffs.status === "pending" && index === nextIndex;
            return (
              <li key={`${step.label}-${index}`} className="flex gap-3">
                <span
                  className={[
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                    rejected
                      ? "bg-red-600 text-white"
                      : step.signed
                        ? "bg-emerald-500 text-white"
                        : current
                          ? "bg-amber-400 text-amber-950"
                          : "bg-slate-200 text-slate-500",
                  ].join(" ")}
                >
                  {rejected ? (
                    <CloseIcon className="h-3.5 w-3.5" />
                  ) : step.signed ? (
                    <CheckIcon className="h-3.5 w-3.5" />
                  ) : current ? (
                    <ClockIcon className="h-3.5 w-3.5" />
                  ) : (
                    <span className="text-[11px] font-semibold">
                      {index + 1}
                    </span>
                  )}
                </span>
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-slate-900">{step.label}</p>
                  <p className="text-slate-600">
                    {step.signed
                      ? `${step.signed.name} · ${formatFriendlyDateTime(new Date(step.signed.signedAt))}`
                      : step.expectedName ||
                        (current ? "Waiting" : "Nobody named yet")}
                  </p>
                  {current && !step.signed ? (
                    <p className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                      <AlertIcon className="h-3 w-3" />
                      Their turn now
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
