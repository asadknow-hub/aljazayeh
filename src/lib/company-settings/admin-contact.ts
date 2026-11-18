import "server-only";

import { and, eq } from "drizzle-orm";
import type { DbTransaction } from "@/db/client";
import {
  membershipRoles,
  memberships,
  organizationSettings,
  roles,
} from "@/db/schema";

export type AdminContact = {
  adminName: string;
  adminEmail: string;
};

/** Organizations where this user holds the system admin role. */
export async function listAdminOrganizationIdsForUser(
  tx: DbTransaction,
  userId: string,
): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ organizationId: memberships.organizationId })
    .from(memberships)
    .innerJoin(
      membershipRoles,
      eq(membershipRoles.membershipId, memberships.id),
    )
    .innerJoin(roles, eq(roles.id, membershipRoles.roleId))
    .where(
      and(
        eq(memberships.userId, userId),
        eq(roles.key, "admin"),
        eq(roles.organizationId, memberships.organizationId),
      ),
    );

  return rows.map((row) => row.organizationId);
}

export async function userIsOrgAdmin(
  tx: DbTransaction,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const [row] = await tx
    .select({ organizationId: memberships.organizationId })
    .from(memberships)
    .innerJoin(
      membershipRoles,
      eq(membershipRoles.membershipId, memberships.id),
    )
    .innerJoin(roles, eq(roles.id, membershipRoles.roleId))
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.organizationId, organizationId),
        eq(roles.key, "admin"),
        eq(roles.organizationId, organizationId),
      ),
    )
    .limit(1);

  return Boolean(row);
}

/** Keep company Admin name/email aligned with the user's profile. */
export async function syncAdminContactToUserOrgs(
  tx: DbTransaction,
  userId: string,
  contact: AdminContact,
): Promise<void> {
  const orgIds = await listAdminOrganizationIdsForUser(tx, userId);
  if (orgIds.length === 0) return;

  const now = new Date();
  for (const organizationId of orgIds) {
    const [existing] = await tx
      .select({ organizationId: organizationSettings.organizationId })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1);

    if (existing) {
      await tx
        .update(organizationSettings)
        .set({
          adminName: contact.adminName,
          adminEmail: contact.adminEmail,
          updatedAt: now,
        })
        .where(eq(organizationSettings.organizationId, organizationId));
    } else {
      await tx.insert(organizationSettings).values({
        organizationId,
        adminName: contact.adminName,
        adminEmail: contact.adminEmail,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}
