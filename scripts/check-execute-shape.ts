import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";

config({ path: ".env.local" });

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client);
  const result = await db.execute(
    sql`select app_is_org_code_available('ZZZ') as available`,
  );
  console.log("result", result);
  console.log("keys", Object.keys(result as object));
  console.log("0", (result as { available?: boolean }[])[0]);
  await client.end();
}

main();
