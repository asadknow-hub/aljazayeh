/**
 * The business runs on Dubai time. Every date is entered, stored and shown in
 * this zone no matter where the server or the browser is. Dubai has no
 * daylight saving, so the UTC offset is fixed.
 */
export const APP_TIME_ZONE = "Asia/Dubai";
const APP_UTC_OFFSET = "+04:00";

/** Combine a YYYY-MM-DD date and HH:MM time typed in Dubai time. */
export function parseAppDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${APP_UTC_OFFSET}`);
}

/** Today's date in Dubai as YYYY-MM-DD. */
export function appDateValue(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** The current time in Dubai as HH:MM (24-hour). */
export function appTimeValue(date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** Friendly datetime matching the app header clock style. */
export function formatFriendlyDateTime(date: Date): string {
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);

  return `${day} · ${time}`;
}

/** Friendly date-only, e.g. Wed, 11 Nov 2026 */
export function formatFriendlyDate(value: string | Date): string {
  const date =
    value instanceof Date
      ? value
      : value.includes("T")
        ? new Date(value)
        : parseAppDateTime(value, "12:00");
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatFriendlyDateRange(start: string, end: string): string {
  if (!start && !end) return "—";
  if (start === end || !end) return formatFriendlyDate(start);
  if (!start) return formatFriendlyDate(end);
  return `${formatFriendlyDate(start)} – ${formatFriendlyDate(end)}`;
}

/** A leave period with its length, e.g. "Thu, 5 Mar 2027 – Fri, 7 May 2027 · 64 days". */
export function formatLeavePeriod(
  startDate: string,
  endDate: string,
  dayCount: number,
): string {
  return `${formatFriendlyDateRange(startDate, endDate)} · ${dayCount === 1 ? "1 day" : `${dayCount} days`}`;
}

/** A date as written on the company's forms: 05-03-2027. */
export function formatFormDate(date: string): string {
  if (!date) return "";
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}-${month}-${year}`;
}

/** A date as written in the company's letters: 05-March-2027. */
export function formatLetterDate(date: string): string {
  if (!date) return "";
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year!, month! - 1, 1)));
  return `${String(day).padStart(2, "0")}-${monthName}-${year}`;
}
