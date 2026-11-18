import "server-only";

import { desc, eq } from "drizzle-orm";
import { withTenantContext } from "@/db/client";
import { visitorLogs } from "@/db/schema";
import { assertCan, can } from "@/lib/access/access";
import { createStarterInquiryInTx } from "@/lib/inquiries/queries";
import { requireOrg, resolveOrg } from "@/lib/org/resolve";
import type {
  VisitorLogInput,
  VisitorLogView,
  VisitorPurpose,
} from "@/lib/visitors/types";
import { normalizeVisitorLogInput } from "@/lib/visitors/validate";
import { UserError } from "@/lib/errors";

function toView(row: typeof visitorLogs.$inferSelect): VisitorLogView {
  return {
    id: row.id,
    organizationId: row.organizationId,
    fullName: row.fullName,
    visitedAt: row.visitedAt.toISOString(),
    purpose: row.purpose as VisitorPurpose,
    notes: row.notes,
    inquiryId: row.inquiryId,
    loggedByUserId: row.loggedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listVisitorLogsForUser(
  userId: string,
  orgCode: string,
): Promise<VisitorLogView[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.useReception(org.access)) return [];

    const rows = await tx
      .select()
      .from(visitorLogs)
      .where(eq(visitorLogs.organizationId, org.id))
      .orderBy(desc(visitorLogs.visitedAt), desc(visitorLogs.createdAt));

    return rows.map(toView);
  });
}

export async function createVisitorLogForUser(
  userId: string,
  orgCode: string,
  input: VisitorLogInput,
): Promise<VisitorLogView> {
  const normalized = normalizeVisitorLogInput(input);

  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    assertCan(can.useReception(org.access));

    const id = crypto.randomUUID();
    const now = new Date();

    await tx.insert(visitorLogs).values({
      id,
      organizationId: org.id,
      fullName: normalized.fullName,
      visitedAt: normalized.visitedAt,
      purpose: normalized.purpose,
      notes: normalized.notes,
      loggedByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });

    if (normalized.purpose === "inquiry") {
      await createStarterInquiryInTx(tx, org, userId, {
        id,
        fullName: normalized.fullName,
        notes: normalized.notes,
      });
    }

    const [row] = await tx
      .select()
      .from(visitorLogs)
      .where(eq(visitorLogs.id, id))
      .limit(1);

    if (!row) {
      throw new UserError("Could not log visitor.");
    }

    return toView(row);
  });
}
