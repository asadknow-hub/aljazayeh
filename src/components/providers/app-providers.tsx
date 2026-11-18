"use client";

import type { ReactNode } from "react";
import { OrgProvider } from "@/components/providers/org-provider";
import { PageTitleProvider } from "@/components/providers/page-title-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import type { Organization } from "@/lib/org/types";

export function AppProviders({
  children,
  initialOrganizations,
  canCreateOrganizations,
}: {
  children: ReactNode;
  initialOrganizations: Organization[];
  canCreateOrganizations: boolean;
}) {
  return (
    <PageTitleProvider>
      <ToastProvider>
        <OrgProvider
          initialOrganizations={initialOrganizations}
          canCreateOrganizations={canCreateOrganizations}
        >
          {children}
        </OrgProvider>
      </ToastProvider>
    </PageTitleProvider>
  );
}
