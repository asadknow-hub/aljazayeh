"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useOrganizations } from "@/components/providers/org-provider";
import { useToast } from "@/components/providers/toast-provider";
import {
  isReservedOrgCode,
  isValidOrgCodeFormat,
  normalizeOrgCode,
  ORG_CODE_MAX_LENGTH,
  slugCode,
} from "@/lib/org/code";

type AddCompanyDialogProps = {
  open: boolean;
  onClose: () => void;
};

function CodeStatusIcon({ unique }: { unique: boolean }) {
  if (unique) {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-4 w-4 text-emerald-600"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 text-red-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function AddCompanyDialog({ open, onClose }: AddCompanyDialogProps) {
  // Mounted only while open, so the form starts empty every time.
  return open ? <AddCompanyForm onClose={onClose} /> : null;
}

function AddCompanyForm({ onClose }: Pick<AddCompanyDialogProps, "onClose">) {
  const { addOrganization, isCodeAvailable } = useOrganizations();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [codeCheck, setCodeCheck] = useState<{
    code: string;
    available: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const titleId = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const normalizedCode = useMemo(() => normalizeOrgCode(code), [code]);
  const codeReserved = normalizedCode
    ? isReservedOrgCode(normalizedCode)
    : false;
  const codeFormatOk = normalizedCode
    ? isValidOrgCodeFormat(normalizedCode)
    : false;
  const showCodeStatus = normalizedCode.length > 0;

  // The last answer from the server only counts for the code it was asked about.
  const codeCheckable = codeFormatOk && !codeReserved;
  const codeChecked = codeCheck?.code === normalizedCode;
  const checkingCode = codeCheckable && !codeChecked;
  const codeAvailable = codeCheckable && codeChecked && codeCheck.available;

  useEffect(() => {
    if (!codeCheckable) return;

    let cancelled = false;
    const handle = window.setTimeout(() => {
      void isCodeAvailable(normalizedCode).then((available) => {
        if (!cancelled) setCodeCheck({ code: normalizedCode, available });
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [normalizedCode, codeCheckable, isCodeAvailable]);

  function onNameChange(value: string) {
    setName(value);
    if (!codeTouched) {
      setCode(slugCode(value));
    }
  }

  function onCodeChange(value: string) {
    setCodeTouched(true);
    setCode(normalizeOrgCode(value));
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Company name is required.");
      return;
    }

    const finalCode = normalizedCode || slugCode(trimmed);
    if (!finalCode || !isValidOrgCodeFormat(finalCode)) {
      setError("Invalid company code format.");
      return;
    }
    if (isReservedOrgCode(finalCode)) {
      setError("This code is reserved by the system.");
      return;
    }
    if (!codeAvailable) {
      setError("This code already exists. Choose a unique code.");
      return;
    }

    setPending(true);
    try {
      await addOrganization({ name: trimmed, code: finalCode });
      onClose();
      showToast("Company created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add company.");
    } finally {
      setPending(false);
    }
  }

  const canSubmit =
    Boolean(name.trim()) &&
    codeFormatOk &&
    !codeReserved &&
    codeAvailable &&
    !checkingCode &&
    !pending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3 sm:p-4">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="card relative z-10 w-full max-w-md shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <h2 id={titleId} className="text-sm font-semibold text-slate-900">
            Add company
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3 p-3">
          <p className="text-xs leading-5 text-slate-500">
            Companies are organizations — the canonical tenant for departments,
            teams, ops, accounts, quotations, and invoices.
          </p>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-700">
              Company name
            </span>
            <input
              ref={nameRef}
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              className="h-9 border border-slate-300 bg-white px-2 text-sm text-slate-950 outline-none focus:border-slate-500 rounded-lg"
              placeholder="e.g. AlJazayeh Trading"
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-700">Code</span>
            <div className="relative">
              <input
                value={code}
                onChange={(event) => onCodeChange(event.target.value)}
                className={[
                  "h-9 w-full border bg-white py-0 pr-9 pl-2 text-sm tracking-wide text-slate-950 outline-none rounded-lg",
                  showCodeStatus && (!codeFormatOk || codeReserved || !codeAvailable)
                    ? "border-red-500 focus:border-red-600"
                    : "border-slate-300 focus:border-slate-500",
                ].join(" ")}
                placeholder="Auto from name"
                maxLength={ORG_CODE_MAX_LENGTH}
                required
                aria-invalid={
                  showCodeStatus &&
                  (!codeFormatOk || codeReserved || !codeAvailable)
                }
              />
              {showCodeStatus && !checkingCode ? (
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2">
                  <CodeStatusIcon
                    unique={codeFormatOk && !codeReserved && codeAvailable}
                  />
                </span>
              ) : null}
            </div>
            {showCodeStatus && !codeFormatOk ? (
              <span className="text-[11px] text-red-600">
                Use a-z, 0-9, and hyphens only
              </span>
            ) : null}
            {showCodeStatus && codeFormatOk && codeReserved ? (
              <span className="text-[11px] text-red-600">
                Code is reserved
              </span>
            ) : null}
            {showCodeStatus && codeFormatOk && !codeReserved && !codeAvailable && !checkingCode ? (
              <span className="text-[11px] text-red-600">
                Code already exists
              </span>
            ) : null}
          </label>

          {error ? (
            <p className="text-xs text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 text-xs text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="btn btn-primary btn-sm h-8 hover:bg-primary-hover-hover"
            >
              {pending ? "Saving…" : "Add company"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
