import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { verifyPassword } from "@/lib/auth/password";

type LoginRow = {
  id: string;
  username: string;
  password_hash: string;
  is_active: boolean;
};

export async function authenticateUser(
  username: string,
  password: string,
): Promise<{ userId: string; username: string } | null> {
  const rows = await db.execute<LoginRow>(sql`
    select * from app_find_user_for_login(${username.trim()})
  `);

  const user = rows[0];
  if (!user || !user.is_active) return null;

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return null;

  return { userId: user.id, username: user.username };
}
