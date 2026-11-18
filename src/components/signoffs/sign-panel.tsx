"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { unwrap, type ActionResult } from "@/lib/actions/result";
import type { SignoffDecision, SignoffState } from "@/lib/signoffs/chains";

type SignInput = { pin: string; decision: SignoffDecision; remarks: string };

/**
 * Where a document stands and, for the person whose turn it is, the box to
 * approve or reject it with their PIN. Not printed.
 */
export function SignPanel({
  signoffs,
  onSign,
}: {
  signoffs: SignoffState;
  onSign: (input: SignInput) => Promise<ActionResult<unknown>>;
}) {
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

  return (
    <div className="border border-zinc-300 bg-white p-4 print:hidden">
      <p className="text-sm font-medium text-zinc-900">
        {signoffs.status === "approved"
          ? "Approved. Everyone has signed."
          : signoffs.status === "rejected"
            ? `Rejected by ${rejection?.name}.`
            : `Waiting for: ${signoffs.waitingFor}`}
      </p>
      {rejection?.remarks ? (
        <p className="mt-1 text-sm text-zinc-700">
          Reason: {rejection.remarks}
        </p>
      ) : null}

      {signoffs.canSign ? (
        <div className="mt-3 flex flex-col gap-3 border-t border-zinc-200 pt-3">
          <p className="text-sm text-zinc-700">
            It is your turn to sign. Approving places your saved signature on
            the form.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-zinc-700">
              Remarks (needed if you reject)
            </span>
            <input
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              className="border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-header"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-zinc-700">
              Your approval PIN
            </span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, ""))
              }
              className="w-32 border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-header"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || pin.length < 4}
              onClick={() => sign("approved")}
              className="bg-header px-4 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control disabled:cursor-not-allowed disabled:opacity-45"
            >
              Approve and sign
            </button>
            <button
              type="button"
              disabled={pending || pin.length < 4}
              onClick={() => sign("rejected")}
              className="border border-red-300 bg-white px-4 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Reject
            </button>
          </div>
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
