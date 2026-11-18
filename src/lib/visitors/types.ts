export const VISITOR_PURPOSES = [
  { value: "inquiry", label: "Inquiry" },
  { value: "progress_update", label: "Progress Update" },
  { value: "general_visit", label: "General Visit" },
  { value: "interview", label: "Interview" },
] as const;

export type VisitorPurpose = (typeof VISITOR_PURPOSES)[number]["value"];

export type VisitorLogInput = {
  fullName: string;
  /** Local date YYYY-MM-DD */
  visitDate: string;
  /** Local time HH:mm */
  visitTime: string;
  purpose: VisitorPurpose;
  notes: string;
};

export type VisitorLogView = {
  id: string;
  organizationId: string;
  fullName: string;
  visitedAt: string;
  purpose: VisitorPurpose;
  notes: string;
  inquiryId: string | null;
  loggedByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export function visitorPurposeLabel(purpose: string): string {
  return (
    VISITOR_PURPOSES.find((item) => item.value === purpose)?.label ?? purpose
  );
}
