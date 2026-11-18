"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import {
  SignaturePad,
  imageFileToDataUrl,
} from "@/components/signoffs/signature-pad";
import { unwrap } from "@/lib/actions/result";
import {
  saveSignatureAction,
  setApprovalPinAction,
} from "@/lib/signoffs/actions";
import type { SigningProfile } from "@/lib/signoffs/credentials";

const inputClass =
  "field w-full max-w-xs";
const buttonClass =
  "btn btn-primary";

/** Account → Signature: the signature and PIN used to approve documents. */
export function SignatureSection({ initial }: { initial: SigningProfile }) {
  const { showToast } = useToast();
  const [saved, setSaved] = useState(initial.signatureImage);
  const [draft, setDraft] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(!initial.signatureImage);
  const [hasPin, setHasPin] = useState(initial.hasPin);
  const [pinLocked, setPinLocked] = useState(initial.pinLocked);
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [pinAgain, setPinAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(work: () => Promise<void>) {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  const saveSignature = (image: string | null) =>
    run(async () => {
      await unwrap(saveSignatureAction(image));
      setSaved(image);
      setDraft(null);
      setReplacing(!image);
      showToast(image ? "Signature saved" : "Signature removed");
    });

  const savePin = () =>
    run(async () => {
      if (pin !== pinAgain) throw new Error("The two PINs do not match.");
      await unwrap(setApprovalPinAction({ password, pin }));
      setHasPin(true);
      setPinLocked(false);
      setPassword("");
      setPin("");
      setPinAgain("");
      showToast("Approval PIN saved");
    });

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h3 className="font-display text-sm font-semibold text-slate-900">
          Your signature
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Placed on every document you approve, with your name and the date.
        </p>

        {saved && !replacing ? (
          <div className="mt-3 flex flex-col items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing to optimise */}
            <img
              src={saved}
              alt="Your saved signature"
              className="h-24 border border-slate-300 bg-white px-3 py-2 rounded-lg"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReplacing(true)}
                className="btn btn-secondary"
              >
                Replace
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => saveSignature(null)}
                className="border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-45 rounded-lg"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-col items-start gap-3">
            <SignaturePad onChange={setDraft} />
            <label className="text-sm text-slate-600">
              or upload a picture of it:{" "}
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void run(async () =>
                    setDraft(await imageFileToDataUrl(file, 480)),
                  );
                }}
                className="text-sm"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending || !draft}
                onClick={() => saveSignature(draft)}
                className={buttonClass}
              >
                Save signature
              </button>
              {saved ? (
                <button
                  type="button"
                  onClick={() => {
                    setReplacing(false);
                    setDraft(null);
                  }}
                  className="btn btn-secondary"
                >
                  Keep current
                </button>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <section className="border-t border-slate-200 pt-6">
        <h3 className="font-display text-sm font-semibold text-slate-900">
          Approval PIN
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          {pinLocked
            ? "Your PIN is locked after too many wrong attempts. Set a new one."
            : hasPin
              ? "You have a PIN. You are asked for it each time you approve or reject. Set a new one below to change it."
              : "Choose a PIN of 4 to 6 digits. You are asked for it each time you approve or reject, so nobody can sign as you from an open screen."}
        </p>
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">
              Your login password
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">New PIN</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, ""))
              }
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">
              New PIN again
            </span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pinAgain}
              onChange={(event) =>
                setPinAgain(event.target.value.replace(/\D/g, ""))
              }
              className={inputClass}
            />
          </label>
          <div>
            <button
              type="button"
              disabled={pending || !password || pin.length < 4 || !pinAgain}
              onClick={savePin}
              className={buttonClass}
            >
              Save PIN
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
