export type StaffActivityLogView = {
  id: string;
  organizationId: string;
  staffId: string;
  staffName: string;
  staffJobTitle: string;
  occurredAt: string;
  category: string;
  action: string;
  summary: string;
  details: string;
  status: string;
  dayCount: number;
  referenceType: string;
  referenceId: string;
};

export type StaffActivityLogInput = {
  organizationId: string;
  staffId: string;
  occurredAt?: Date;
  category: string;
  action: string;
  summary: string;
  details?: string;
  status?: string;
  dayCount?: number;
  referenceType?: string;
  referenceId?: string;
  actorUserId?: string | null;
};

export function activityCategoryLabel(category: string): string {
  if (category === "vacation") return "Vacation";
  if (category === "staff") return "Staff";
  if (category === "timesheet") return "Timesheet";
  return category;
}

export function activityDayCountLabel(count: number): string {
  if (!count) return "—";
  return count === 1 ? "1 day" : `${count} days`;
}
