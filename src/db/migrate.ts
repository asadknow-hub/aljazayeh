import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL_ADMIN or DATABASE_URL is required");
  }

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  console.log("Running Drizzle migrations...");
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

  const rlsPath = path.join(process.cwd(), "src", "db", "rls.sql");
  const rlsSql = fs.readFileSync(rlsPath, "utf8");
  console.log("Applying RLS policies + grants...");
  await client.unsafe(rlsSql);

  await client.unsafe(`
    create or replace function app_find_user_for_login(p_username text)
    returns table (
      id uuid,
      username text,
      password_hash text,
      is_active boolean
    )
    language sql
    security definer
    set search_path = public
    as $$
      select u.id, u.username, u.password_hash, u.is_active
      from users u
      where lower(u.username) = lower(p_username)
      limit 1;
    $$;

    revoke all on function app_find_user_for_login(text) from public;
    grant execute on function app_find_user_for_login(text) to aljazayeh;

    create or replace function app_is_org_code_available(p_code text)
    returns boolean
    language sql
    security definer
    set search_path = public
    as $$
      select not exists (
        select 1 from organizations o where o.code = lower(p_code)
      );
    $$;

    revoke all on function app_is_org_code_available(text) from public;
    grant execute on function app_is_org_code_available(text) to aljazayeh;

    create or replace function app_record_login(
      p_user_id uuid,
      p_ip_address text,
      p_user_agent text
    )
    returns uuid
    language plpgsql
    security definer
    set search_path = public
    as $$
    declare
      new_id uuid;
    begin
      insert into user_login_events (user_id, ip_address, user_agent, success)
      values (
        p_user_id,
        left(coalesce(p_ip_address, ''), 128),
        left(coalesce(p_user_agent, ''), 512),
        true
      )
      returning id into new_id;
      return new_id;
    end;
    $$;

    revoke all on function app_record_login(uuid, text, text) from public;
    grant execute on function app_record_login(uuid, text, text) to aljazayeh;
  `);

  await client.end();
  console.log("Migrations complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
