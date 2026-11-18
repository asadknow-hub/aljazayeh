export const RECEPTION_SECTIONS = [
  { key: "attendance", label: "Attendance" },
  { key: "vacation", label: "Vacation" },
  { key: "visitors", label: "Visitors" },
] as const;

export type ReceptionSection = (typeof RECEPTION_SECTIONS)[number]["key"];

export function isReceptionSection(value: string): value is ReceptionSection {
  return RECEPTION_SECTIONS.some((item) => item.key === value);
}
