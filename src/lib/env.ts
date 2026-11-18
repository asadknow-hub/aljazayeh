import "server-only";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function getDatabaseUrl(): string {
  return required("DATABASE_URL");
}

export function getAuthSecret(): string {
  return required("AUTH_SECRET");
}
