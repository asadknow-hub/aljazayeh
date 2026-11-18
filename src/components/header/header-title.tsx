"use client";

import { useCurrentPageTitle } from "@/components/providers/page-title-provider";

export function HeaderTitle() {
  const title = useCurrentPageTitle();

  return (
    <h1 className="font-display truncate px-2 text-center text-base font-medium tracking-tight text-header-fg">
      {title}
    </h1>
  );
}
