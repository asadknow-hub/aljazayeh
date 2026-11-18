import {
  FORM_DEFINITIONS,
  formTypesRaisedIn,
  type FormType,
} from "@/lib/forms/definitions";

export type ReceptionSection =
  | "attendance"
  | "vacation"
  | "visitors"
  | FormType;

/** Reception's sidebar: its own sections, then the forms it raises. */
export const RECEPTION_SECTIONS: { key: ReceptionSection; label: string }[] = [
  { key: "attendance", label: "Attendance" },
  { key: "vacation", label: "Vacation" },
  { key: "visitors", label: "Visitors" },
  ...formTypesRaisedIn("reception").map((type) => ({
    key: type,
    label: FORM_DEFINITIONS[type].listLabel,
  })),
];

export function isReceptionSection(value: string): value is ReceptionSection {
  return RECEPTION_SECTIONS.some((item) => item.key === value);
}
