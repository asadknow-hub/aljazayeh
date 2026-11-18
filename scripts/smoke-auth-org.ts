import { config } from "dotenv";
import bcrypt from "bcryptjs";
import postgres from "postgres";

config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const sql = postgres(url, { max: 1 });

  const users = await sql<
    { id: string; username: string; password_hash: string; is_active: boolean }[]
  >`select * from app_find_user_for_login('admin')`;
  const user = users[0];
  if (!user) throw new Error("admin user missing");
  const ok = await bcrypt.compare("admin", user.password_hash);
  if (!ok) throw new Error("password mismatch");
  console.log("auth ok", user.id, user.username);

  await sql.begin(async (tx) => {
    await tx`select set_config('app.user_id', ${user.id}, true)`;
    const orgId = crypto.randomUUID();
    const membershipId = crypto.randomUUID();
    const roleId = crypto.randomUUID();

    await tx`
      insert into organizations (id, name, code)
      values (${orgId}, 'Smoke Co', 'SMOKE-CO')
    `;
    await tx`
      insert into memberships (id, user_id, organization_id)
      values (${membershipId}, ${user.id}, ${orgId})
    `;
    await tx`
      insert into roles (id, organization_id, key, name, is_system)
      values (${roleId}, ${orgId}, 'admin', 'Admin', true)
    `;
    await tx`
      insert into membership_roles (membership_id, role_id)
      values (${membershipId}, ${roleId})
    `;
    const orgs =
      await tx`select id, code, name from organizations where id = ${orgId}`;
    console.log("created org", orgs[0]);
  });

  await sql.end();
  console.log("smoke ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
