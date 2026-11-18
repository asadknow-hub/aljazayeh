/** Friendly datetime matching the app header clock style. */
export function formatFriendlyDateTime(date: Date): string {
  const day = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);

  const time = new Intl.DateTimeFormat("en-GB", {
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
      : new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatFriendlyDateRange(start: string, end: string): string {
  if (!start && !end) return "—";
  if (start === end || !end) return formatFriendlyDate(start);
  if (!start) return formatFriendlyDate(end);
  return `${formatFriendlyDate(start)} – ${formatFriendlyDate(end)}`;
}

/** Compact friendly summary for selected vacation days. */
export function formatVacationDuration(
  selectedDates: string[],
  dayCount: number,
  startDate: string,
  endDate: string,
): string {
  const count = dayCount || selectedDates.length;
  const countLabel = count === 1 ? "1 day" : `${count} days`;

  if (selectedDates.length === 1) {
    return `${formatFriendlyDate(selectedDates[0]!)} · ${countLabel}`;
  }

  if (selectedDates.length > 1) {
    return `${formatFriendlyDate(selectedDates[0]!)} – ${formatFriendlyDate(
      selectedDates[selectedDates.length - 1]!,
    )} · ${countLabel}`;
  }

  if (startDate || endDate) {
    return `${formatFriendlyDateRange(startDate, endDate)} · ${countLabel}`;
  }

  return countLabel;
}
