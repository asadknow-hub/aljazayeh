import { weekdayOf } from "@/lib/datetime/calendar";

/**
 * Attendance as kept on the company's monthly "Employee Attendance Sheet":
 * one mark per person per day.
 */

/** How a mark is counted in the monthly totals. */
type Counts = "present" | "absent" | "half";

/** Marks Reception enters. `code` is what the printed sheet shows. */
export const ATTENDANCE_STATUSES = [
  { key: "present", code: "P", label: "Present", counts: "present" },
  { key: "absent", code: "A", label: "Absent", counts: "absent" },
  { key: "half_day", code: "HF", label: "Half day", counts: "half" },
  { key: "md", code: "MD", label: "MD", counts: "present" },
  { key: "off", code: "OFF", label: "Off", counts: "present" },
] as const satisfies readonly {
  key: string;
  code: string;
  label: string;
  counts: Counts;
}[];

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]["key"];

/**
 * What a day shows on the sheet. Besides an entered mark it can be worked
 * out from other records: an approved leave, or a date before the person
 * joined. Both count as absent days. Empty means not marked yet.
 */
export type AttendanceCell = AttendanceStatus | "vacation" | "not_joined" | "";

export function isAttendanceStatus(value: string): value is AttendanceStatus {
  return ATTENDANCE_STATUSES.some((status) => status.key === value);
}

export function attendanceCode(cell: AttendanceCell): string {
  if (cell === "vacation") return "VACATION";
  if (cell === "not_joined") return "NEW JOIN";
  return ATTENDANCE_STATUSES.find((status) => status.key === cell)?.code ?? "";
}

function cellCounts(cell: AttendanceCell): Counts | null {
  if (cell === "") return null;
  if (cell === "vacation" || cell === "not_joined") return "absent";
  return ATTENDANCE_STATUSES.find((status) => status.key === cell)!.counts;
}

export type AttendanceTotals = {
  present: number;
  absent: number;
  half: number;
};

export function attendanceTotals(cells: AttendanceCell[]): AttendanceTotals {
  const totals = { present: 0, absent: 0, half: 0 };
  for (const cell of cells) {
    const counts = cellCounts(cell);
    if (counts) totals[counts] += 1;
  }
  return totals;
}

/** The sheet is kept separately for the workshop and for the office. */
export const ATTENDANCE_GROUPS = [
  { key: "workers", label: "Workers" },
  { key: "office", label: "Office staff" },
] as const;

export type AttendanceGroup = (typeof ATTENDANCE_GROUPS)[number]["key"];

export function isAttendanceGroup(value: string): value is AttendanceGroup {
  return ATTENDANCE_GROUPS.some((group) => group.key === value);
}

/* -------------------------------- calendar -------------------------------- */

/** Friday is the weekly day off. */
const WEEKLY_OFF_WEEKDAY = 5;

export function isWeeklyOff(date: string): boolean {
  return weekdayOf(date) === WEEKLY_OFF_WEEKDAY;
}

/** "2026-10" → "OCTOBER 2026", as printed in the sheet title. */
export function monthTitle(month: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(`${month}-01T00:00:00Z`))
    .toUpperCase();
}

/** "2026-10-02" → "2/10/2026", as printed in the sheet's column headings. */
export function sheetDateLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${day}/${month}/${year}`;
}

/* ---------------------------------- views --------------------------------- */

/** One person on the daily marking screen. */
export type AttendanceDayRow = {
  staffId: string;
  fullName: string;
  jobTitle: string;
  group: AttendanceGroup;
  /** The mark entered for this day, if any. */
  status: AttendanceStatus | "";
  /** Why the day is already accounted for without a mark. */
  derived: "vacation" | "not_joined" | "";
};

export type AttendanceDay = {
  date: string;
  weeklyOff: boolean;
  rows: AttendanceDayRow[];
};

export type AttendanceMark = {
  staffId: string;
  /** Empty clears the mark. */
  status: AttendanceStatus | "";
};

export type AttendanceSheetRow = {
  staffId: string;
  fullName: string;
  /** One cell per date of the month. */
  cells: AttendanceCell[];
  totals: AttendanceTotals;
};

export type AttendanceSheet = {
  companyName: string;
  month: string;
  dates: string[];
  group: AttendanceGroup;
  rows: AttendanceSheetRow[];
  /** Notes printed under the sheet. */
  notes: string[];
};
