import "server-only";

import { sql } from "drizzle-orm";
import type { DbTransaction } from "@/db/client";
import { documentCounters } from "@/db/schema";
import { appDateValue } from "@/lib/datetime/format";

/**
 * The next running number for a kind of document, e.g. "AJE/FN/2026/0007".
 * Numbers restart each year and are never reused; two people saving at the
 * same moment get different numbers.
 *
 * `counterKey` says which count it is and never changes. `code` is what is
 * written in the number; a company may choose its own, and the count carries
 * on when it does.
 */
export async function nextDocumentNumber(
  tx: DbTransaction,
  org: { id: string; code: string },
  counterKey: string,
  code: string = counterKey,
): Promise<string> {
  const year = Number(appDateValue().slice(0, 4));
  const [counter] = await tx
    .insert(documentCounters)
    .values({ organizationId: org.id, counterKey, year, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [
        documentCounters.organizationId,
        documentCounters.counterKey,
        documentCounters.year,
      ],
      set: { lastNumber: sql`${documentCounters.lastNumber} + 1` },
    })
    .returning({ lastNumber: documentCounters.lastNumber });

  const number = String(counter!.lastNumber).padStart(4, "0");
  return `${org.code.toUpperCase()}/${code}/${year}/${number}`;
}
