import "server-only";

import type { DbTransaction } from "@/db/client";
import { staffActivityLogs } from "@/db/schema";
import type { StaffActivityLogInput } from "@/lib/activity/types";

export async function insertStaffActivityLog(
  tx: DbTransaction,
  input: StaffActivityLogInput,
) {
  const now = input.occurredAt ?? new Date();
  await tx.insert(staffActivityLogs).values({
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    staffId: input.staffId,
    occurredAt: now,
    category: input.category,
    action: input.action,
    summary: input.summary,
    details: input.details ?? "",
    status: input.status ?? "",
    dayCount: input.dayCount ?? 0,
    referenceType: input.referenceType ?? "",
    referenceId: input.referenceId ?? "",
    actorUserId: input.actorUserId ?? null,
    createdAt: now,
    updatedAt: now,
  });
}
