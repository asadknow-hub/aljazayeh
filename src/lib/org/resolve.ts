import "server-only";

import { and, eq } from "drizzle-orm";
import type { DbTransaction } from "@/db/client";
import { memberships, organizations } from "@/db/schema";
import { normalizeOrgCode } from "@/lib/org/code";

export type ResolvedOrg = {
  id: string;
  name: string;
  code: string;
};

/**
 * Turn the company code from the URL into the company row, but only if the
 * user is a member. Every company-scoped query starts here: the URL code is
 * never trusted on its own.
 */
export async function resolveOrg(
  tx: DbTransaction,
  userId: string,
  orgCode: string,
): Promise<ResolvedOrg | null> {
  const [org] = await tx
    .select({
      id: organizations.id,
      name: organizations.name,
      code: organizations.code,
    })
    .from(organizations)
    .innerJoin(
      memberships,
      and(
        eq(memberships.organizationId, organizations.id),
        eq(memberships.userId, userId),
      ),
    )
    .where(eq(organizations.code, normalizeOrgCode(orgCode)))
    .limit(1);

  return org ?? null;
}
