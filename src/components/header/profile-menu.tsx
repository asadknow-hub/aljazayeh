"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/login/actions";

type ProfileMenuProps = {
  fullName: string;
};

export function ProfileMenu({ fullName }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profile menu"
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-header-muted/40 bg-header-control text-header-fg transition hover:border-header-muted/70 hover:bg-header-control-hover"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <circle cx="12" cy="8" r="3.25" />
          <path
            strokeLinecap="round"
            d="M5.5 18.25c1.4-2.4 3.7-3.75 6.5-3.75s5.1 1.35 6.5 3.75"
          />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-50 mt-2 w-48 overflow-hidden border border-slate-200 bg-white shadow-sm rounded-lg"
        >
          <div className="border-b border-slate-100 px-3 py-2.5 text-left">
            <p className="truncate text-sm font-medium text-slate-900">
              {fullName}
            </p>
          </div>
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Settings
          </Link>
          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              className="w-full border-t border-slate-100 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
