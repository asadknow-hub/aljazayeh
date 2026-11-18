import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

// `drizzle-kit generate` only reads the schema; the URL matters for commands
// that connect (studio, introspect), which need the admin connection.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_ADMIN ?? "",
  },
  strict: true,
  verbose: true,
});
