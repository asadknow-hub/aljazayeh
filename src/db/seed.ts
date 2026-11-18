import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getAdminDatabaseUrl } from "@/db/admin-env";
import { users } from "@/db/schema";

/**
 * Create the owner's login: the one account that can create companies.
 * Everyone else gets a login from a company administrator inside the app.
 *
 * Set OWNER_USERNAME / OWNER_PASSWORD to choose the credentials. Without
 * them a local development login (admin / admin) is created, which is
 * refused in production.
 */
async function main() {
  const username = (process.env.OWNER_USERNAME ?? "admin").trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD ?? "";

  if (!password && process.env.NODE_ENV === "production") {
    throw new Error("Set OWNER_PASSWORD to create the owner login in production.");
  }

  const client = postgres(getAdminDatabaseUrl(), { max: 1 });
  try {
    const db = drizzle(client);
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existing) {
      console.log(`Owner login "${username}" already exists; left unchanged.`);
      return;
    }

    await db.insert(users).values({
      username,
      fullName: "Owner",
      passwordHash: await bcrypt.hash(password || "admin", 12),
      isPlatformAdmin: true,
    });
    console.log(
      password
        ? `Created owner login "${username}".`
        : `Created development owner login (${username} / admin).`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
