import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import postgres from "postgres";
import { getAdminDatabaseUrl, getAppDatabaseUrl } from "@/db/admin-env";

/** Group role created by drizzle/0000_access_functions.sql. */
const APP_GROUP_ROLE = "aljazayeh_app";

type Sql = ReturnType<typeof postgres>;

/**
 * Make sure the login role in DATABASE_URL exists, can only act through the
 * app group role, and cannot bypass Row Level Security.
 */
async function provisionAppRole(sql: Sql) {
  const appUrl = new URL(getAppDatabaseUrl());
  const adminUrl = new URL(getAdminDatabaseUrl());
  const appRole = decodeURIComponent(appUrl.username);
  const appPassword = decodeURIComponent(appUrl.password);

  if (!appRole || appRole === decodeURIComponent(adminUrl.username)) {
    throw new Error(
      "DATABASE_URL must use its own login role, different from DATABASE_URL_ADMIN. " +
        "The admin role owns the tables, and owners bypass Row Level Security.",
    );
  }

  const [existing] = await sql<{ unsafe: boolean }[]>`
    select (rolsuper or rolbypassrls) as unsafe
    from pg_roles
    where rolname = ${appRole}
  `;

  if (!existing) {
    const [{ statement }] = await sql<{ statement: string }[]>`
      select format('create role %I login password %L', ${appRole}::text, ${appPassword}::text) as statement
    `;
    await sql.unsafe(statement);
    console.log(`Created app login role "${appRole}".`);
  } else if (existing.unsafe) {
    throw new Error(
      `App role "${appRole}" is a superuser or has BYPASSRLS, so Row Level Security would not apply. Use a plain login role.`,
    );
  }

  const [{ statement: grantMembership }] = await sql<{ statement: string }[]>`
    select format('grant %I to %I', ${APP_GROUP_ROLE}::text, ${appRole}::text) as statement
  `;
  await sql.unsafe(grantMembership);

  await sql.unsafe(`
    grant select, insert, update, delete on all tables in schema public to ${APP_GROUP_ROLE};
    grant usage, select on all sequences in schema public to ${APP_GROUP_ROLE};
  `);
}

/** Every table must be protected; a table without RLS is open to all companies. */
async function assertRowLevelSecurity(sql: Sql) {
  const unprotected = await sql<{ name: string }[]>`
    select c.relname as name
    from pg_class c
    inner join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
    order by c.relname
  `;
  if (unprotected.length > 0) {
    throw new Error(
      `Tables without Row Level Security: ${unprotected.map((t) => t.name).join(", ")}. ` +
        "Add policies for them in src/db/schema.ts.",
    );
  }
}

async function main() {
  const sql = postgres(getAdminDatabaseUrl(), { max: 1, onnotice: () => {} });
  try {
    console.log("Applying migrations...");
    await migrate(drizzle(sql), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
    await provisionAppRole(sql);
    await assertRowLevelSecurity(sql);
    console.log("Database is up to date.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
