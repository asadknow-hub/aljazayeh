"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { unwrap } from "@/lib/actions/result";
import { setSignatoryAction } from "@/lib/signoffs/actions";
import type { SignatoriesView } from "@/lib/signoffs/queries";

/** Company Settings → Signatories: who signs for each position on the forms. */
export function SignatoriesSection({
  orgCode,
  initial,
}: {
  orgCode: string;
  initial: SignatoriesView;
}) {
  const { showToast } = useToast();
  const [positions, setPositions] = useState(initial.positions);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function assign(key: string, staffId: string) {
    setError(null);
    setSavingKey(key);
    try {
      await unwrap(setSignatoryAction(orgCode, key, staffId));
      setPositions((current) =>
        current.map((position) =>
          position.key === key ? { ...position, staffId } : position,
        ),
      );
      showToast("Signatory saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <>
      <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
        <h2 className="font-display text-base font-semibold text-slate-900">
          Signatories
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          The company&apos;s forms are signed by position. Choose who signs for
          each one. Only active staff with a login can be chosen; each of them
          sets their own signature and PIN under Account.
        </p>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        {positions.map((position) => (
          <label
            key={position.key}
            className="grid grid-cols-1 items-center gap-1.5 sm:grid-cols-[14rem_1fr]"
          >
            <span className="text-sm font-medium text-slate-800">
              {position.label}
            </span>
            <select
              value={position.staffId}
              disabled={savingKey !== null}
              onChange={(event) => assign(position.key, event.target.value)}
              className="field max-w-sm"
            >
              <option value="">Nobody yet</option>
              {initial.candidates.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.fullName}
                  {staff.jobTitle ? ` · ${staff.jobTitle}` : ""}
                </option>
              ))}
            </select>
          </label>
        ))}

        {initial.candidates.length === 0 ? (
          <p className="text-sm text-slate-600">
            Nobody has a login yet. Create logins under Staff first.
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </>
  );
}
