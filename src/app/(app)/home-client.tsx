"use client";

import { useRouter } from "next/navigation";
import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { AddCompanyDialog } from "@/components/org/add-company-dialog";
import { useOrganizations } from "@/components/providers/org-provider";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { companyPath } from "@/lib/org/code";

export function HomeClient() {
  usePageTitle("Select Company");
  const router = useRouter();
  const {
    organizations,
    setDefaultOrganizationId,
    ready,
  } = useOrganizations();
  const [addOpen, setAddOpen] = useState(false);

  function openCompany(code: string) {
    router.push(companyPath(code));
  }

  function onCardKeyDown(event: KeyboardEvent<HTMLDivElement>, code: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCompany(code);
    }
  }

  async function toggleDefault(
    event: MouseEvent<HTMLButtonElement>,
    orgId: string,
    isDefault: boolean,
  ) {
    event.preventDefault();
    event.stopPropagation();
    await setDefaultOrganizationId(isDefault ? null : orgId);
  }

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ready
          ? organizations.map((org) => {
              const isDefault = Boolean(org.isDefault);
              return (
                <div
                  key={org.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => openCompany(org.code)}
                  onKeyDown={(event) => onCardKeyDown(event, org.code)}
                  className="flex min-h-36 cursor-pointer flex-col justify-between border border-zinc-300 bg-white p-4 text-left transition hover:border-zinc-400 hover:bg-zinc-50"
                >
                  <span className="font-mono text-[11px] tracking-wide text-zinc-500">
                    {org.code}
                  </span>

                  <p className="mt-3 font-display text-base font-semibold text-zinc-900">
                    {org.name}
                  </p>

                  <button
                    type="button"
                    aria-pressed={isDefault}
                    onClick={(event) => toggleDefault(event, org.id, isDefault)}
                    className="mt-4 inline-flex items-center gap-2 self-start text-[11px] text-zinc-600 transition hover:text-zinc-900"
                  >
                    <span
                      className={[
                        "flex h-5 w-5 shrink-0 items-center justify-center border",
                        isDefault
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                          : "border-zinc-300 bg-white text-transparent",
                      ].join(" ")}
                      aria-hidden
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </span>
                    <span>Make Default on Login</span>
                  </button>
                </div>
              );
            })
          : null}

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex min-h-36 flex-col items-center justify-center gap-2 border border-dashed border-zinc-400 bg-white text-zinc-700 transition hover:border-header hover:bg-zinc-50 hover:text-header"
        >
          <span className="text-3xl leading-none font-light" aria-hidden>
            +
          </span>
          <span className="text-sm font-medium">Add company</span>
        </button>
      </div>

      <AddCompanyDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </main>
  );
}
