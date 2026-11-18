import type { VisitorLogInput, VisitorPurpose } from "@/lib/visitors/types";

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
    throw new Error("Select a valid date and time.");
  }

  const year = Number(visitDate.slice(0, 4));
  if (year < 1900 || year > 2100) {
    throw new Error("Year must be a 4-digit year.");
  }

  const date = new Date(`${visitDate}T${visitTime}:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Select a valid date and time.");
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
    throw new Error("Enter the visitor name.");
  }

  const purpose = input.purpose;
  if (!PURPOSE_SET.has(purpose)) {
    throw new Error("Select a purpose.");
  }

  return {
    fullName,
    visitedAt: parseVisitedAt(input.visitDate, input.visitTime),
    purpose,
    notes: clean(input.notes),
  };
}

export function toLocalDateValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toLocalTimeValue(date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
