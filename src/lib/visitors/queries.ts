import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { withTenantContext } from "@/db/client";
import { memberships, organizations, visitorLogs } from "@/db/schema";
import { createStarterInquiryInTx } from "@/lib/inquiries/queries";
import { normalizeOrgCode } from "@/lib/org/code";
import type {
  VisitorLogInput,
  VisitorLogView,
  VisitorPurpose,
} from "@/lib/visitors/types";
import { normalizeVisitorLogInput } from "@/lib/visitors/validate";

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
    const org = await resolveOrgId(tx, userId, orgCode);
    if (!org) return [];

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
    const org = await resolveOrgId(tx, userId, orgCode);
    if (!org) {
      throw new Error("Company not found.");
    }

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
      await createStarterInquiryInTx(tx, {
        userId,
        organizationId: org.id,
        customerName: normalized.fullName,
        notes: normalized.notes,
        sourceVisitorId: id,
      });
    }

    const [row] = await tx
      .select()
      .from(visitorLogs)
      .where(eq(visitorLogs.id, id))
      .limit(1);

    if (!row) {
      throw new Error("Could not log visitor.");
    }

    return toView(row);
  });
}
