import "server-only";

import { and, eq, ne, sql } from "drizzle-orm";
import type { DbTransaction } from "@/db/client";
import { documentCounters, staffMembers } from "@/db/schema";
import { UserError } from "@/lib/errors";

/** The count the IDs come from. It never restarts, so `year` stays 0. */
const COUNTER_KEY = "EMP";

async function taken(
  tx: DbTransaction,
  organizationId: string,
  employeeCode: string,
  exceptStaffId?: string,
): Promise<boolean> {
  const [row] = await tx
    .select({ id: staffMembers.id })
    .from(staffMembers)
    .where(
      and(
        eq(staffMembers.organizationId, organizationId),
        eq(staffMembers.employeeCode, employeeCode),
        exceptStaffId ? ne(staffMembers.id, exceptStaffId) : undefined,
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * The employee ID a record is saved with. Everyone the company employs,
 * staff and workers alike, has one, and no two people share one: it is what
 * their salaries and other records are looked up by.
 *
 * An ID that is typed is kept as typed. Left empty, the person gets the
 * company's next free number, "EMP-0007"; a number is never given twice,
 * even after the person who had it has left.
 */
export async function employeeIdFor(
  tx: DbTransaction,
  organizationId: string,
  typed: string,
  staffId?: string,
): Promise<string> {
  if (typed) {
    if (await taken(tx, organizationId, typed, staffId)) {
      throw new UserError(
        `Employee ID ${typed} already belongs to someone else. Give another one, or leave it empty to get the next free number.`,
      );
    }
    return typed;
  }

  for (;;) {
    const [counter] = await tx
      .insert(documentCounters)
      .values({
        organizationId,
        counterKey: COUNTER_KEY,
        year: 0,
        lastNumber: 1,
      })
      .onConflictDoUpdate({
        target: [
          documentCounters.organizationId,
          documentCounters.counterKey,
          documentCounters.year,
        ],
        set: { lastNumber: sql`${documentCounters.lastNumber} + 1` },
      })
      .returning({ lastNumber: documentCounters.lastNumber });
    const id = `EMP-${String(counter!.lastNumber).padStart(4, "0")}`;
    // A number someone typed by hand for another person is passed over.
    if (!(await taken(tx, organizationId, id))) return id;
  }
}
