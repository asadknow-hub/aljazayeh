import { UserError } from "@/lib/errors";

export const ORG_CODE_MAX_LENGTH = 64;

/**
 * Paths reserved for the platform. Company codes must never collide with these.
 * Authz/RLS keys off organization UUID after code → org resolution.
 */
export const RESERVED_ORG_CODES = new Set([
  "login",
  "logout",
  "api",
  "admin",
  "settings",
  "select-company",
  "company",
  "org",
  "organization",
  "health",
  "status",
  "assets",
  "static",
  "favicon.ico",
  "_next",
]);

/** Canonical org code pattern used by UI + server (lowercase). */
export const ORG_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugCode(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, ORG_CODE_MAX_LENGTH);
}

export function normalizeOrgCode(code: string): string {
  return code.trim().toLowerCase().slice(0, ORG_CODE_MAX_LENGTH);
}

export function isReservedOrgCode(code: string): boolean {
  return RESERVED_ORG_CODES.has(normalizeOrgCode(code));
}

export function isValidOrgCodeFormat(code: string): boolean {
  const normalized = normalizeOrgCode(code);
  if (!normalized || normalized.length > ORG_CODE_MAX_LENGTH) return false;
  return ORG_CODE_PATTERN.test(normalized);
}

export function assertValidOrgCode(code: string): string {
  const normalized = normalizeOrgCode(code);
  if (!isValidOrgCodeFormat(normalized)) {
    throw new UserError(
      "Company code must be a-z, 0-9, with single hyphens (e.g. aljazayeh-tr).",
    );
  }
  if (isReservedOrgCode(normalized)) {
    throw new UserError("This code is reserved by the system.");
  }
  return normalized;
}

export function companyPath(code: string): string {
  return `/${normalizeOrgCode(code)}`;
}
