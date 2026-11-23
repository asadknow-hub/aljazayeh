import "server-only";

import { and, eq } from "drizzle-orm";
import type { DbTransaction } from "@/db/client";
import {
  organizations,
  organizationSettings,
  staffDepartmentAssignments,
  staffMembers,
} from "@/db/schema";
import type { OrgAccess } from "@/lib/access/access";
import { isAssignableDepartmentKey } from "@/lib/departments/catalog";
import { UserError } from "@/lib/errors";
import { normalizeOrgCode } from "@/lib/org/code";

export type ResolvedOrg = {
  id: string;
  name: string;
  code: string;
  access: OrgAccess;
};

/**
 * Turn the company code from the URL into the company and what the user may
 * do in it. Returns null unless the user has an active staff record there.
 * Every company-scoped query starts here: the URL code is never trusted on
 * its own.
 */
export async function resolveOrg(
  tx: DbTransaction,
  userId: string,
  orgCode: string,
): Promise<ResolvedOrg | null> {
  const [row] = await tx
    .select({
      id: organizations.id,
      name: organizations.name,
      code: organizations.code,
      staffId: staffMembers.id,
      isAdmin: staffMembers.isAdmin,
      closedDepartments: organizationSettings.closedDepartments,
    })
    .from(organizations)
    .innerJoin(
      staffMembers,
      and(
        eq(staffMembers.organizationId, organizations.id),
        eq(staffMembers.userId, userId),
        eq(staffMembers.status, "active"),
      ),
    )
    .leftJoin(
      organizationSettings,
      eq(organizationSettings.organizationId, organizations.id),
    )
    .where(eq(organizations.code, normalizeOrgCode(orgCode)))
    .limit(1);

  if (!row) return null;

  const assignments = await tx
    .select({ departmentKey: staffDepartmentAssignments.departmentKey })
    .from(staffDepartmentAssignments)
    .where(eq(staffDepartmentAssignments.staffId, row.staffId));

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    access: {
      staffId: row.staffId,
      isAdmin: row.isAdmin,
      departments: assignments
        .map((item) => item.departmentKey)
        .filter(isAssignableDepartmentKey),
      closedDepartments: (row.closedDepartments ?? []).filter(
        isAssignableDepartmentKey,
      ),
    },
  };
}

/** Same as resolveOrg, for mutations: a missing company is an error. */
export async function requireOrg(
  tx: DbTransaction,
  userId: string,
  orgCode: string,
): Promise<ResolvedOrg> {
  const org = await resolveOrg(tx, userId, orgCode);
  if (!org) throw new UserError("Company not found.");
  return org;
}
