"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  checkOrgCodeAvailableAction,
  createOrganizationAction,
  setDefaultOrganizationAction,
} from "@/lib/org/actions";
import type { Organization } from "@/lib/org/types";
import {
  isReservedOrgCode,
  isValidOrgCodeFormat,
  normalizeOrgCode,
} from "@/lib/org/code";

type OrgContextValue = {
  organizations: Organization[];
  defaultOrganization: Organization | null;
  ready: boolean;
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
}: {
  children: ReactNode;
  initialOrganizations: Organization[];
}) {
  const [organizations, setOrganizations] =
    useState<Organization[]>(initialOrganizations);
  const [, startTransition] = useTransition();

  const refreshOrganizations = useCallback((next: Organization[]) => {
    setOrganizations(next);
  }, []);

  const setDefaultOrganizationId = useCallback(async (id: string | null) => {
    await setDefaultOrganizationAction(id);
    setOrganizations((current) =>
      current.map((org) => ({
        ...org,
        isDefault: id ? org.id === id : false,
      })),
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
      const created = await createOrganizationAction(input);
      const organization: Organization = {
        id: created.id,
        name: created.name,
        code: created.code,
        createdAt: new Date().toISOString(),
        isDefault: organizations.every((org) => !org.isDefault),
      };

      startTransition(() => {
        setOrganizations((current) => {
          const withDefaults = organization.isDefault
            ? current.map((org) => ({ ...org, isDefault: false }))
            : current;
          return [...withDefaults, organization];
        });
      });

      return organization;
    },
    [organizations],
  );

  const defaultOrganization = useMemo(
    () => organizations.find((org) => org.isDefault) ?? null,
    [organizations],
  );

  const value = useMemo(
    () => ({
      organizations,
      defaultOrganization,
      ready: true,
      refreshOrganizations,
      addOrganization,
      setDefaultOrganizationId,
      isCodeAvailable,
    }),
    [
      organizations,
      defaultOrganization,
      refreshOrganizations,
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
