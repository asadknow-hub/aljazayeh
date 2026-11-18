import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db, withTenantContext, type DbTransaction } from "@/db/client";
import {
  inquiryWorkflowSettings,
  organizationSettings,
  organizations,
  staffMembers,
  userPreferences,
  users,
} from "@/db/schema";
import { UserError } from "@/lib/errors";
import { INQUIRY_STAGES } from "@/lib/inquiries/stages";
import { assertValidOrgCode } from "@/lib/org/code";
import { resolveOrg } from "@/lib/org/resolve";

export type OrgListItem = {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
  isDefault: boolean;
};

/** Companies where the user has an active staff record. */
export async function listUserOrganizations(
  userId: string,
): Promise<OrgListItem[]> {
  return withTenantContext(userId, async (tx) => {
    const rows = await tx
      .select({
        id: organizations.id,
        name: organizations.name,
        code: organizations.code,
        createdAt: organizations.createdAt,
        defaultOrganizationId: userPreferences.defaultOrganizationId,
      })
      .from(staffMembers)
      .innerJoin(
        organizations,
        eq(organizations.id, staffMembers.organizationId),
      )
      .leftJoin(userPreferences, eq(userPreferences.userId, staffMembers.userId))
      .where(
        and(eq(staffMembers.userId, userId), eq(staffMembers.status, "active")),
      )
      .orderBy(organizations.name);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      createdAt: row.createdAt,
      isDefault: row.defaultOrganizationId === row.id,
    }));
  });
}

export async function resolveOrganizationForUser(
  userId: string,
  orgCode: string,
) {
  return withTenantContext(userId, (tx) => resolveOrg(tx, userId, orgCode));
}

/** Only platform admins (the owner's login) may create companies. */
export async function userCanCreateOrganizations(
  userId: string,
): Promise<boolean> {
  return withTenantContext(userId, (tx) => isPlatformAdmin(tx));
}

async function isPlatformAdmin(tx: DbTransaction): Promise<boolean> {
  const rows = await tx.execute<{ allowed: boolean }>(
    sql`select app_is_platform_admin() as allowed`,
  );
  return Boolean(rows[0]?.allowed);
}

export async function isOrganizationCodeAvailable(
  code: string,
): Promise<boolean> {
  let normalized: string;
  try {
    normalized = assertValidOrgCode(code);
  } catch {
    return false;
  }
  const result = await db.execute<{ available: boolean }>(sql`
    select app_is_org_code_available(${normalized}) as available
  `);
  return Boolean(result[0]?.available);
}

/**
 * Create a company with everything it needs to be usable straight away:
 * settings, the default workflow, and the creator as its first staff member
 * and administrator.
 */
export async function createOrganizationForUser(
  userId: string,
  input: { name: string; code: string },
) {
  const name = input.name.trim();
  if (!name) {
    throw new UserError("Company name is required.");
  }
  const code = assertValidOrgCode(input.code);

  return withTenantContext(userId, async (tx) => {
    if (!(await isPlatformAdmin(tx))) {
      throw new UserError("You don't have permission to create companies.");
    }

    const available = await tx.execute<{ available: boolean }>(sql`
      select app_is_org_code_available(${code}) as available
    `);
    if (!available[0]?.available) {
      throw new UserError("Company code already exists.");
    }

    // The company row is not readable until the creator is on its staff, so
    // ids are generated here instead of being read back from the insert.
    const organizationId = crypto.randomUUID();

    await tx.insert(organizations).values({ id: organizationId, name, code });
    await tx.execute(sql`
      select app_claim_new_organization(
        ${organizationId}::uuid,
        ${crypto.randomUUID()}::uuid
      )
    `);

    const [creator] = await tx
      .select({ fullName: users.fullName, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    await tx.insert(organizationSettings).values({
      organizationId,
      adminName: creator?.fullName.trim() ?? "",
      adminEmail: creator?.email.trim() ?? "",
    });

    await tx.insert(inquiryWorkflowSettings).values(
      INQUIRY_STAGES.map((stage) => ({
        organizationId,
        stageKey: stage.key,
        departmentKey: "admin",
      })),
    );

    await tx
      .insert(userPreferences)
      .values({ userId, defaultOrganizationId: organizationId })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          defaultOrganizationId: sql`coalesce(${userPreferences.defaultOrganizationId}, ${organizationId}::uuid)`,
          updatedAt: new Date(),
        },
      });

    return { id: organizationId, name, code };
  });
}

export async function setDefaultOrganizationForUser(
  userId: string,
  organizationId: string | null,
) {
  if (organizationId) {
    const mine = await listUserOrganizations(userId);
    if (!mine.some((org) => org.id === organizationId)) {
      throw new UserError("You are not a member of that company.");
    }
  }

  return withTenantContext(userId, async (tx) => {
    await tx
      .insert(userPreferences)
      .values({ userId, defaultOrganizationId: organizationId })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { defaultOrganizationId: organizationId, updatedAt: new Date() },
      });
  });
}
