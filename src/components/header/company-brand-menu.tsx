"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useOrganizations } from "@/components/providers/org-provider";
import {
  companyPath,
  isReservedOrgCode,
  normalizeOrgCode,
} from "@/lib/org/code";

export function CompanyBrandMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { organizations } = useOrganizations();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const orgCode = useMemo(() => {
    const segment = pathname.split("/").filter(Boolean)[0];
    if (!segment) return null;
    const code = normalizeOrgCode(segment);
    if (!code || isReservedOrgCode(code)) return null;
    return code;
  }, [pathname]);

  const current = useMemo(
    () =>
      orgCode
        ? (organizations.find(
            (org) => normalizeOrgCode(org.code) === orgCode,
          ) ?? null)
        : null,
    [organizations, orgCode],
  );

  const inCompany = Boolean(current);

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

  if (!inCompany || !current) {
    return (
      <Link
        href="/"
        className="font-display text-base font-semibold tracking-tight text-header-fg transition hover:text-white"
      >
        AlJazayeh
      </Link>
    );
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex max-w-[14rem] items-center gap-1.5 text-left sm:max-w-[18rem]"
      >
        <span className="font-display truncate text-base font-semibold tracking-tight text-header-fg">
          {current.name}
        </span>
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-header-muted"
          fill="currentColor"
        >
          <path d="M5.25 7.5L10 12.25 14.75 7.5H5.25z" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-full left-0 z-50 mt-2 w-56 overflow-hidden border border-slate-200 bg-white shadow-sm rounded-lg"
        >
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="text-[11px] tracking-wide text-slate-400 uppercase">
              Companies
            </p>
          </div>
          <div className="max-h-64 overflow-auto py-1">
            {organizations.map((org) => {
              const active = org.id === current.id;
              return (
                <button
                  key={org.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    router.push(companyPath(org.code));
                  }}
                  className={[
                    "flex w-full flex-col items-start px-3 py-2 text-left transition hover:bg-slate-50",
                    active ? "bg-slate-50" : "",
                  ].join(" ")}
                >
                  <span className="truncate text-sm font-medium text-slate-900">
                    {org.name}
                  </span>
                  <span className="font-mono text-[10px] tracking-wide text-slate-500">
                    {org.code}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-slate-100 p-1">
            <Link
              href="/"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Select Company
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
