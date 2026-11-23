import "server-only";

import { asc, eq } from "drizzle-orm";
import type { DbTransaction } from "@/db/client";
import { orgPositions, staffMembers } from "@/db/schema";
import { CHART_DEPARTMENTS, DEFAULT_POSITIONS } from "@/lib/organization/chart";
import { OWNERS_BLOCK, type SigningPosition } from "@/lib/signoffs/chains";

/** Where a block comes on the chart: owners, then the departments in order. */
function blockRank(block: string): number {
  if (block === OWNERS_BLOCK) return -1;
  const index = CHART_DEPARTMENTS.findIndex((item) => item.key === block);
  return index === -1 ? CHART_DEPARTMENTS.length : index;
}

/**
 * The positions of a company in chart order, with who holds each. Owners
 * come first, in the order they sign.
 */
export async function loadPositions(
  tx: DbTransaction,
  organizationId: string,
): Promise<SigningPosition[]> {
  const rows = await tx
    .select({
      id: orgPositions.id,
      block: orgPositions.block,
      title: orgPositions.title,
      signsAs: orgPositions.signsAs,
      staffId: orgPositions.staffId,
      staffName: staffMembers.fullName,
    })
    .from(orgPositions)
    .leftJoin(staffMembers, eq(staffMembers.id, orgPositions.staffId))
    .where(eq(orgPositions.organizationId, organizationId))
    .orderBy(asc(orgPositions.sortOrder), asc(orgPositions.createdAt));

  return rows
    .map((row) => ({ ...row, staffName: row.staffName ?? "" }))
    .sort((a, b) => blockRank(a.block) - blockRank(b.block));
}

/** Give a new company the positions its forms are signed by, nobody in them. */
export async function seedDefaultChart(
  tx: DbTransaction,
  organizationId: string,
): Promise<void> {
  await tx.insert(orgPositions).values(
    DEFAULT_POSITIONS.map((position, index) => ({
      organizationId,
      ...position,
      sortOrder: index,
    })),
  );
}
