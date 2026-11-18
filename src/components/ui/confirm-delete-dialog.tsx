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
  title = "Confirm delete",
  message,
  pending = false,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (!open) {
      setSecondsLeft(COUNTDOWN_SECONDS);
      return;
    }

    setSecondsLeft(COUNTDOWN_SECONDS);
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
  }, [open]);

  if (!open) return null;

  const canDelete = secondsLeft === 0 && !pending;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        className="w-full max-w-md border border-zinc-300 bg-white shadow-lg"
      >
        <div className="border-b border-zinc-200 px-4 py-3">
          <h3
            id="confirm-delete-title"
            className="font-display text-base font-semibold text-zinc-900"
          >
            {title}
          </h3>
        </div>
        <div className="px-4 py-4 text-sm text-zinc-700">{message}</div>
        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-45"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canDelete}
            className="border border-red-300 bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45"
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
