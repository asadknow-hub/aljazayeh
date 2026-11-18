import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db, withTenantContext } from "@/db/client";
import {
  inquiryWorkflowSettings,
  membershipRoles,
  memberships,
  organizationSettings,
  organizations,
  permissions,
  rolePermissions,
  roles,
  staffDepartmentAssignments,
  staffMembers,
  userPreferences,
  users,
} from "@/db/schema";
import { INQUIRY_STAGES } from "@/lib/inquiries/stages";
import {
  assertValidOrgCode,
  normalizeOrgCode,
} from "@/lib/org/code";

export type OrgListItem = {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
  isDefault: boolean;
};

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
      .from(memberships)
      .innerJoin(
        organizations,
        eq(organizations.id, memberships.organizationId),
      )
      .leftJoin(userPreferences, eq(userPreferences.userId, memberships.userId))
      .where(eq(memberships.userId, userId))
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

export async function getDefaultOrganization(userId: string) {
  return withTenantContext(userId, async (tx) => {
    const [prefs] = await tx
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (!prefs?.defaultOrganizationId) return null;

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
      .where(eq(organizations.id, prefs.defaultOrganizationId))
      .limit(1);

    return org ?? null;
  });
}

export async function resolveOrganizationForUser(
  userId: string,
  orgCode: string,
) {
  const code = normalizeOrgCode(orgCode);
  return withTenantContext(userId, async (tx) => {
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
      .where(eq(organizations.code, code))
      .limit(1);

    return org ?? null;
  });
}

export async function isOrganizationCodeAvailable(
  code: string,
): Promise<boolean> {
  try {
    const normalized = assertValidOrgCode(code);
    const result = await db.execute<{ available: boolean }>(sql`
      select app_is_org_code_available(${normalized}) as available
    `);
    return Boolean(result[0]?.available);
  } catch {
    return false;
  }
}

export async function createOrganizationForUser(
  userId: string,
  input: { name: string; code: string },
) {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Company name is required.");
  }
  const code = assertValidOrgCode(input.code);

  return withTenantContext(userId, async (tx) => {
    const available = await tx.execute<{ available: boolean }>(sql`
      select app_is_org_code_available(${code}) as available
    `);
    if (!available[0]?.available) {
      throw new Error("Company code already exists.");
    }

    // Generate IDs in-app so we can insert membership before any SELECT/RETURNING
    // (RETURNING would require SELECT policy, which needs membership first).
    const organizationId = crypto.randomUUID();
    const membershipId = crypto.randomUUID();

    await tx.insert(organizations).values({
      id: organizationId,
      name,
      code,
    });

    await tx.execute(sql`
      select app_insert_org_membership(
        ${membershipId}::uuid,
        ${organizationId}::uuid,
        ${userId}::uuid
      )
    `);

    const [creator] = await tx
      .select({
        fullName: users.fullName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const adminName = creator?.fullName?.trim() ?? "";
    const adminEmail = creator?.email?.trim() ?? "";

    await tx.insert(organizationSettings).values({
      organizationId,
      adminName,
      adminEmail,
    });

    const now = new Date();
    await tx.insert(inquiryWorkflowSettings).values(
      INQUIRY_STAGES.map((stage) => ({
        id: crypto.randomUUID(),
        organizationId,
        stageKey: stage.key,
        departmentKey: "admin",
        approvalRequired: false,
        approvalRequiredBy: "",
        createdAt: now,
        updatedAt: now,
      })),
    );

    const staffId = crypto.randomUUID();
    await tx.insert(staffMembers).values({
      id: staffId,
      organizationId,
      userId,
      fullName: adminName || "Admin",
      email: adminEmail,
      jobTitle: "Admin",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(staffDepartmentAssignments).values([
      { staffId, departmentKey: "admin" },
      { staffId, departmentKey: "management" },
    ]);

    const [org] = await tx
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      throw new Error("Failed to create organization.");
    }

    const [adminRole] = await tx
      .insert(roles)
      .values({
        organizationId: org.id,
        key: "admin",
        name: "Admin",
        isSystem: true,
      })
      .returning();

    const allPermissions = await tx.select().from(permissions);
    if (allPermissions.length > 0) {
      await tx.insert(rolePermissions).values(
        allPermissions.map((permission) => ({
          roleId: adminRole.id,
          permissionId: permission.id,
        })),
      );
    }

    await tx.insert(membershipRoles).values({
      membershipId,
      roleId: adminRole.id,
    });

    const [prefs] = await tx
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (!prefs) {
      await tx.insert(userPreferences).values({
        userId,
        defaultOrganizationId: org.id,
      });
    } else if (!prefs.defaultOrganizationId) {
      await tx
        .update(userPreferences)
        .set({
          defaultOrganizationId: org.id,
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.userId, userId));
    }

    return org;
  });
}

export async function setDefaultOrganizationForUser(
  userId: string,
  organizationId: string | null,
) {
  return withTenantContext(userId, async (tx) => {
    if (organizationId) {
      const [membership] = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, userId),
            eq(memberships.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!membership) {
        throw new Error("You are not a member of that company.");
      }
    }

    const [prefs] = await tx
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (!prefs) {
      await tx.insert(userPreferences).values({
        userId,
        defaultOrganizationId: organizationId,
      });
    } else {
      await tx
        .update(userPreferences)
        .set({
          defaultOrganizationId: organizationId,
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.userId, userId));
    }
  });
}
