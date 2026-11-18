import "server-only";

import { desc, eq } from "drizzle-orm";
import { withTenantContext } from "@/db/client";
import { staffActivityLogs, staffMembers } from "@/db/schema";
import { can } from "@/lib/access/access";
import type { StaffActivityLogView } from "@/lib/activity/types";
import { resolveOrg } from "@/lib/org/resolve";

export async function listStaffActivityLogsForUser(
  userId: string,
  orgCode: string,
): Promise<StaffActivityLogView[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.viewActivityLog(org.access)) return [];

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
