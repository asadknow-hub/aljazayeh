import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

export type SessionUser = {
  userId: string;
  username: string;
};

type SessionPayload = SessionUser & {
  exp: number;
};

/** Safe for proxy.ts (Edge/Node boundary) — reads process.env directly. */
function authSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("AUTH_SECRET is required.");
  }
  return secret;
}

function sign(body: string): string {
  return createHmac("sha256", authSecret()).update(body).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function encodeSession(user: SessionUser, now: number): string {
  const payload: SessionPayload = {
    ...user,
    exp: now + SESSION_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/**
 * Decode a signed session token.
 * Pass `now` (e.g. from proxy) to enforce expiry. RSC render paths omit it —
 * Cache Components forbids Date.now() during prerender; proxy already gates expiry.
 */
export function decodeSession(
  token: string | undefined | null,
  now?: number,
): SessionUser | null {
  if (!token) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  try {
    if (!safeEqual(sign(body), signature)) return null;

    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;

    if (!payload.userId || !payload.username || !payload.exp) return null;
    if (now !== undefined && payload.exp < now) return null;

    return {
      userId: payload.userId,
      username: payload.username,
    };
  } catch {
    return null;
  }
}
