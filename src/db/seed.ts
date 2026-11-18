import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getAdminDatabaseUrl } from "@/db/admin-env";
import { permissions, users } from "@/db/schema";

const BASE_PERMISSIONS = [
  { key: "org.read", description: "View organization" },
  { key: "org.manage", description: "Manage organization settings" },
  { key: "members.read", description: "View members" },
  { key: "members.manage", description: "Manage members and roles" },
  { key: "roles.manage", description: "Manage roles and permissions" },
  { key: "staff.read", description: "View staff directory" },
  { key: "staff.manage", description: "Create, update, and delete staff" },
] as const;

async function main() {
  const client = postgres(getAdminDatabaseUrl(), { max: 1 });
  const db = drizzle(client);

  console.log("Seeding permissions...");
  for (const permission of BASE_PERMISSIONS) {
    const existing = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(eq(permissions.key, permission.key))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(permissions).values(permission);
    }
  }

  console.log("Seeding admin user...");
  const passwordHash = await bcrypt.hash("admin", 12);
  const existingAdmin = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, "admin"))
    .limit(1);

  if (existingAdmin.length === 0) {
    await db.insert(users).values({
      username: "admin",
      fullName: "System Admin",
      email: "admin@aljazayeh.local",
      passwordHash,
      isActive: true,
    });
    console.log("Created admin user (admin / admin).");
  } else {
    console.log("Admin user already exists — leaving name/email/password unchanged.");
  }

  await client.end();
  console.log("Seed complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
