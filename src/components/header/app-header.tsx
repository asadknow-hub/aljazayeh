import { Suspense } from "react";
import Link from "next/link";
import { CompanyBrandMenu } from "@/components/header/company-brand-menu";
import { HeaderClock } from "@/components/header/header-clock";
import { HeaderProfile } from "@/components/header/header-profile";
import { HeaderTitle } from "@/components/header/header-title";

function ProfileFallback() {
  return (
    <div
      className="h-8 w-8 rounded-full border border-header-muted/35 bg-header-control"
      aria-hidden
    />
  );
}

function BrandFallback() {
  return (
    <Link
      href="/"
      className="font-display text-base font-semibold tracking-tight text-header-fg"
    >
      AlJazayeh
    </Link>
  );
}

export function AppHeader() {
  return (
    <header className="sticky top-0 print:hidden z-40 border-b border-header-border bg-header text-header-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="grid h-12 w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2 sm:px-3">
        <div className="min-w-0 justify-self-start">
          <Suspense fallback={<BrandFallback />}>
            <CompanyBrandMenu />
          </Suspense>
        </div>

        <div className="min-w-0 max-w-[40vw] justify-self-center sm:max-w-md">
          <HeaderTitle />
        </div>

        <div className="flex min-w-0 items-center justify-self-end gap-2 sm:gap-3">
          <HeaderClock />
          <Suspense fallback={<ProfileFallback />}>
            <HeaderProfile />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
