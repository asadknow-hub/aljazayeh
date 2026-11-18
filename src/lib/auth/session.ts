import "server-only";

import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/auth/config";
import {
  decodeSession,
  encodeSession,
  type SessionUser,
} from "@/lib/auth/session-token";

export type { SessionUser };

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  // Expiry is enforced in proxy.ts (request boundary). Avoid Date.now() here —
  // Cache Components flags it during prerender even inside Suspense.
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function setSession(user: SessionUser): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(user, Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
