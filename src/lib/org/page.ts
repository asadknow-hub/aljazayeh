import "server-only";

import { notFound } from "next/navigation";
import type { OrgAccess } from "@/lib/access/access";
import { getSession, type SessionUser } from "@/lib/auth/session";
import { isReservedOrgCode, normalizeOrgCode } from "@/lib/org/code";
import { resolveOrganizationForUser } from "@/lib/org/queries";
import type { ResolvedOrg } from "@/lib/org/resolve";

/**
 * Shared entry point for every page under /{orgCode}: requires a signed-in
 * member of that company who passes `allowed` (a rule from `can`), otherwise
 * renders the 404 page.
 */
export async function loadOrgPage(
  rawOrgCode: string,
  allowed: (access: OrgAccess) => boolean = () => true,
): Promise<{ session: SessionUser; org: ResolvedOrg }> {
  const session = await getSession();
  if (!session) notFound();

  const orgCode = normalizeOrgCode(rawOrgCode);
  if (!orgCode || isReservedOrgCode(orgCode)) notFound();

  const org = await resolveOrganizationForUser(session.userId, orgCode);
  if (!org || !allowed(org.access)) notFound();

  return { session, org };
}

/** Read a single-valued query-string parameter such as `?section=`. */
export function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}
