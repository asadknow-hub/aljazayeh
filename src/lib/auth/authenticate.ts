import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { UserError } from "@/lib/errors";

/** Wrong passwords in a row before a login is locked, and for how long. */
export const MAX_FAILED_LOGINS = 20;
export const LOGIN_LOCK_MINUTES = 15;

type LoginRow = {
  id: string;
  username: string;
  password_hash: string;
  is_active: boolean;
};

/**
 * Check a username and password. Returns the user, or null when they do not
 * match. Throws a UserError while the login is locked after too many wrong
 * passwords; the lock ends by itself, or when an administrator resets the
 * password.
 */
export async function authenticateUser(
  username: string,
  password: string,
): Promise<{ userId: string; username: string } | null> {
  const rows = await db.execute<LoginRow>(sql`
    select * from app_find_user_for_login(${username.trim()})
  `);

  const user = rows[0];
  if (!user || !user.is_active) return null;

  const [lock] = await db.execute<{ minutes: number | null }>(sql`
    select app_login_locked_minutes(${user.id}::uuid) as minutes
  `);
  const minutes = lock?.minutes ?? 0;
  if (minutes > 0) {
    throw new UserError(
      `Too many wrong passwords. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}, or ask your administrator to reset your password.`,
    );
  }

  if (!(await verifyPassword(password, user.password_hash))) {
    await db.execute(sql`
      select app_record_failed_login(
        ${user.id}::uuid,
        ${MAX_FAILED_LOGINS}::integer,
        ${LOGIN_LOCK_MINUTES}::integer
      )
    `);
    return null;
  }

  return { userId: user.id, username: user.username };
}
