import { config } from "dotenv";

config({ path: ".env.local" });

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

/** Owner connection for migrations and seeding. Never used by the running app. */
export function getAdminDatabaseUrl(): string {
  return required("DATABASE_URL_ADMIN");
}

/** The connection the running app uses; Row Level Security applies to it. */
export function getAppDatabaseUrl(): string {
  return required("DATABASE_URL");
}
