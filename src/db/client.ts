import "server-only";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { getDatabaseUrl } from "@/lib/env";

const globalForDb = globalThis as unknown as {
  postgresClient?: ReturnType<typeof postgres>;
  db?: ReturnType<typeof drizzle<typeof schema>>;
};

function getClient() {
  if (!globalForDb.postgresClient) {
    globalForDb.postgresClient = postgres(getDatabaseUrl(), {
      max: 10,
      prepare: false,
    });
  }
  return globalForDb.postgresClient;
}

export const db =
  globalForDb.db ?? drizzle(getClient(), { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

export type DbTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

/**
 * Run work with Postgres GUC app.user_id set for RLS policies.
 */
export async function withTenantContext<T>(
  userId: string,
  fn: (tx: DbTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}
