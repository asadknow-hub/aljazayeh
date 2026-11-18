import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { withTenantContext } from "@/db/client";
import {
  memberships,
  organizations,
  staffActivityLogs,
  staffMembers,
} from "@/db/schema";
import type { StaffActivityLogView } from "@/lib/activity/types";
import { normalizeOrgCode } from "@/lib/org/code";

async function resolveOrgId(
  tx: Parameters<Parameters<typeof withTenantContext>[1]>[0],
  userId: string,
  orgCode: string,
) {
  const code = normalizeOrgCode(orgCode);
  const [org] = await tx
    .select({ id: organizations.id, code: organizations.code })
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
}

export async function listStaffActivityLogsForUser(
  userId: string,
  orgCode: string,
): Promise<StaffActivityLogView[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrgId(tx, userId, orgCode);
    if (!org) return [];

    const rows = await tx
      .select({
        log: staffActivityLogs,
        staffName: staffMembers.fullName,
        staffJobTitle: staffMembers.jobTitle,
      })
      .from(staffActivityLogs)
      .innerJoin(staffMembers, eq(staffMembers.id, staffActivityLogs.staffId))
      .where(eq(staffActivityLogs.organizationId, org.id))
      .orderBy(
        desc(staffActivityLogs.occurredAt),
        desc(staffActivityLogs.createdAt),
      );

    return rows.map((row) => ({
      id: row.log.id,
      organizationId: row.log.organizationId,
      staffId: row.log.staffId,
      staffName: row.staffName,
      staffJobTitle: row.staffJobTitle,
      occurredAt: row.log.occurredAt.toISOString(),
      category: row.log.category,
      action: row.log.action,
      summary: row.log.summary,
      details: row.log.details,
      status: row.log.status,
      dayCount: row.log.dayCount,
      referenceType: row.log.referenceType,
      referenceId: row.log.referenceId,
    }));
  });
}
