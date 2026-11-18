"use client";

import { useEffect, useState } from "react";

type ConfirmDeleteDialogProps = {
  open: boolean;
  title?: string;
  message: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const COUNTDOWN_SECONDS = 3;

export function ConfirmDeleteDialog({
  open,
  ...props
}: ConfirmDeleteDialogProps) {
  // Mounted only while open, so the countdown restarts every time.
  return open ? <ConfirmDeleteDialogBody {...props} /> : null;
}

function ConfirmDeleteDialogBody({
  title = "Confirm delete",
  message,
  pending = false,
  onCancel,
  onConfirm,
}: Omit<ConfirmDeleteDialogProps, "open">) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, []);

  const canDelete = secondsLeft === 0 && !pending;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        className="card w-full max-w-md shadow-lg"
      >
        <div className="border-b border-slate-200 px-4 py-3">
          <h3
            id="confirm-delete-title"
            className="font-display text-base font-semibold text-slate-900"
          >
            {title}
          </h3>
        </div>
        <div className="px-4 py-4 text-sm text-slate-700">{message}</div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canDelete}
            className="border border-red-300 bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45 rounded-lg"
          >
            {pending
              ? "Deleting…"
              : secondsLeft > 0
                ? `Delete (${secondsLeft})`
                : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
