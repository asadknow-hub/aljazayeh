"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { unwrap } from "@/lib/actions/result";
import {
  checkOrgCodeAvailableAction,
  createOrganizationAction,
  setDefaultOrganizationAction,
} from "@/lib/org/actions";
import {
  isReservedOrgCode,
  isValidOrgCodeFormat,
  normalizeOrgCode,
} from "@/lib/org/code";
import type { Organization } from "@/lib/org/types";

type OrgContextValue = {
  /** Companies the signed-in person works for. */
  organizations: Organization[];
  /** Only the owner's login may create companies. */
  canCreateOrganizations: boolean;
  refreshOrganizations: (next: Organization[]) => void;
  addOrganization: (input: {
    name: string;
    code?: string;
  }) => Promise<Organization>;
  setDefaultOrganizationId: (id: string | null) => Promise<void>;
  isCodeAvailable: (code: string) => Promise<boolean>;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({
  children,
  initialOrganizations,
  canCreateOrganizations,
}: {
  children: ReactNode;
  initialOrganizations: Organization[];
  canCreateOrganizations: boolean;
}) {
  const [organizations, setOrganizations] =
    useState<Organization[]>(initialOrganizations);

  const setDefaultOrganizationId = useCallback(async (id: string | null) => {
    await unwrap(setDefaultOrganizationAction(id));
    setOrganizations((current) =>
      current.map((org) => ({ ...org, isDefault: org.id === id })),
    );
  }, []);

  const isCodeAvailable = useCallback(async (code: string) => {
    const normalized = normalizeOrgCode(code);
    if (!isValidOrgCodeFormat(normalized) || isReservedOrgCode(normalized)) {
      return false;
    }
    return checkOrgCodeAvailableAction(normalized);
  }, []);

  const addOrganization = useCallback(
    async (input: { name: string; code?: string }) => {
      const created = await unwrap(createOrganizationAction(input));
      const organization: Organization = {
        ...created,
        createdAt: new Date().toISOString(),
        // The first company becomes the default on login.
        isDefault: organizations.every((org) => !org.isDefault),
      };
      setOrganizations((current) => [...current, organization]);
      return organization;
    },
    [organizations],
  );

  const value = useMemo(
    () => ({
      organizations,
      canCreateOrganizations,
      refreshOrganizations: setOrganizations,
      addOrganization,
      setDefaultOrganizationId,
      isCodeAvailable,
    }),
    [
      organizations,
      canCreateOrganizations,
      addOrganization,
      setDefaultOrganizationId,
      isCodeAvailable,
    ],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrganizations(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    throw new Error("useOrganizations must be used within OrgProvider");
  }
  return ctx;
}
