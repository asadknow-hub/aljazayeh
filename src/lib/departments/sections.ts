/** Sidebar sections of a department workspace. */
export const DEPARTMENT_SECTIONS = [
  { key: "inquiries", label: "Inquiries" },
  { key: "invoice", label: "Invoice" },
] as const;

export type DepartmentSection = (typeof DEPARTMENT_SECTIONS)[number]["key"];

export function isDepartmentSection(value: string): value is DepartmentSection {
  return DEPARTMENT_SECTIONS.some((item) => item.key === value);
}
