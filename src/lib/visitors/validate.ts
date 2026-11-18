import { parseAppDateTime } from "@/lib/datetime/format";
import type { VisitorLogInput, VisitorPurpose } from "@/lib/visitors/types";
import { UserError } from "@/lib/errors";

const PURPOSE_SET = new Set<VisitorPurpose>([
  "inquiry",
  "progress_update",
  "general_visit",
  "interview",
]);

function clean(value: string): string {
  return value.trim();
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isLocalTime(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value);
}

function parseVisitedAt(dateValue: string, timeValue: string): Date {
  const visitDate = clean(dateValue);
  const visitTime = clean(timeValue);

  if (!isIsoDate(visitDate) || !isLocalTime(visitTime)) {
    throw new UserError("Select a valid date and time.");
  }

  const year = Number(visitDate.slice(0, 4));
  if (year < 1900 || year > 2100) {
    throw new UserError("Year must be a 4-digit year.");
  }

  const date = parseAppDateTime(visitDate, visitTime);
  if (Number.isNaN(date.getTime())) {
    throw new UserError("Select a valid date and time.");
  }
  return date;
}

export type NormalizedVisitorLog = {
  fullName: string;
  visitedAt: Date;
  purpose: VisitorPurpose;
  notes: string;
};

export function normalizeVisitorLogInput(
  input: VisitorLogInput,
): NormalizedVisitorLog {
  const fullName = clean(input.fullName);
  if (!fullName) {
    throw new UserError("Enter the visitor name.");
  }

  const purpose = input.purpose;
  if (!PURPOSE_SET.has(purpose)) {
    throw new UserError("Select a purpose.");
  }

  return {
    fullName,
    visitedAt: parseVisitedAt(input.visitDate, input.visitTime),
    purpose,
    notes: clean(input.notes),
  };
}
