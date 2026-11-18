/**
 * Arithmetic on plain calendar days ("2026-10-31") and months ("2026-10").
 * UTC is used only to do the sums, so no timezone can shift the day.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_MS = 86_400_000;

const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fromTime = (time: number) => new Date(time).toISOString().slice(0, 10);

export function isIsoDate(value: string): boolean {
  // Also rejects impossible dates such as 2026-02-31.
  return ISO_DATE.test(value) && fromTime(toTime(value)) === value;
}

export function isIsoMonth(value: string): boolean {
  return ISO_MONTH.test(value);
}

export function addDays(date: string, days: number): string {
  return fromTime(toTime(date) + days * DAY_MS);
}

/** Days from `start` to `end`, counting both. */
export function daysInclusive(start: string, end: string): number {
  return Math.round((toTime(end) - toTime(start)) / DAY_MS) + 1;
}

/** 0 = Sunday … 5 = Friday, 6 = Saturday. */
export function weekdayOf(date: string): number {
  return new Date(toTime(date)).getUTCDay();
}

/** Every date of a month, in order. */
export function datesOfMonth(month: string): string[] {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from(
    { length: count },
    (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`,
  );
}

/** Whole years and months between two dates, e.g. "2 Years and 3 Months". */
export function durationInYearsAndMonths(from: string, to: string): string {
  const [fromYear, fromMonth, fromDay] = from
    .split("-")
    .map(Number) as number[];
  const [toYear, toMonth, toDay] = to.split("-").map(Number) as number[];
  let months = (toYear! - fromYear!) * 12 + (toMonth! - fromMonth!);
  if (toDay! < fromDay!) months -= 1;
  if (months < 0) return "";

  const plural = (count: number, word: string) =>
    `${count} ${word}${count === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return plural(rest, "Month");
  return rest === 0
    ? plural(years, "Year")
    : `${plural(years, "Year")} and ${plural(rest, "Month")}`;
}
