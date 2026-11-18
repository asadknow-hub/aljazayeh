/**
 * Fixed platform departments. Functionality is added module-by-module later;
 * keys/slugs stay stable for routing and permissions.
 */
export const DEPARTMENTS = [
  {
    key: "staff",
    slug: "staff",
    label: "Staff",
    accent: "#0d9488",
  },
  {
    key: "accounts",
    slug: "accounts",
    label: "Accounts",
    accent: "#7c3aed",
  },
  {
    key: "reception",
    slug: "reception",
    label: "Reception",
    accent: "#ea580c",
  },
  {
    key: "sales",
    slug: "sales",
    label: "Sales",
    accent: "#2563eb",
  },
  {
    key: "engineering",
    slug: "engineering",
    label: "Engineering Department",
    accent: "#db2777",
  },
  {
    key: "admin",
    slug: "admin",
    label: "Admin",
    accent: "#0f766e",
  },
  {
    key: "all-logs",
    slug: "all-logs",
    label: "All Logs",
    accent: "#475569",
  },
  {
    key: "company-settings",
    slug: "company-settings",
    label: "Company Settings",
    accent: "#4f46e5",
  },
] as const;

export type Department = (typeof DEPARTMENTS)[number];
export type DepartmentKey = Department["key"];
export type DepartmentSlug = Department["slug"];

/**
 * Roles/departments that staff can be assigned to in HR.
 * Management = admin-level org role; Workers = operational workforce.
 */
export const STAFF_ASSIGNABLE_ROLES = [
  { key: "management", label: "Management" },
  { key: "accounts", label: "Accounts" },
  { key: "reception", label: "Reception" },
  { key: "sales", label: "Sales" },
  { key: "engineering", label: "Engineering Department" },
  { key: "admin", label: "Admin" },
  { key: "workers", label: "Workers" },
] as const;

export type StaffRoleKey = (typeof STAFF_ASSIGNABLE_ROLES)[number]["key"];

/** @deprecated Use STAFF_ASSIGNABLE_ROLES */
export const ASSIGNABLE_DEPARTMENTS = STAFF_ASSIGNABLE_ROLES;

export function departmentPath(orgCode: string, slug: DepartmentSlug): string {
  return `/${orgCode}/${slug}`;
}

export function isAssignableDepartmentKey(key: string): key is StaffRoleKey {
  return STAFF_ASSIGNABLE_ROLES.some((role) => role.key === key);
}

export function departmentLabel(key: string): string {
  const role = STAFF_ASSIGNABLE_ROLES.find((item) => item.key === key);
  if (role) return role.label;
  return DEPARTMENTS.find((dept) => dept.key === key)?.label ?? key;
}
