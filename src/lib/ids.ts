const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a value coming from a URL or a form can be a record id at all.
 * Checked before querying, so a mistyped link is "not found" instead of a
 * database error.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
