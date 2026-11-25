/**
 * The daily overtime sheet: who worked past their hours on one day, for how
 * long, and what that comes to.
 *
 * Overtime is paid by the hour at the person's own rate: a month's salary
 * is 30 days, and a working day is 9 hours. Each figure is rounded to fils
 * as it is printed, so the sheet adds up when checked with a calculator.
 */

/** Days a month's salary is spread over. */
export const OVERTIME_DAYS_IN_MONTH = 30;
/** Working hours in a day. */
export const OVERTIME_HOURS_IN_DAY = 9;

const round2 = (value: number) => Math.round(value * 100) / 100;

export type OvertimePay = {
  salary: number;
  perDay: number;
  perHour: number;
  amount: number;
};

export function overtimePay(salary: number, hours: number): OvertimePay {
  const perDay = round2(salary / OVERTIME_DAYS_IN_MONTH);
  const perHour = round2(perDay / OVERTIME_HOURS_IN_DAY);
  return { salary, perDay, perHour, amount: round2(perHour * hours) };
}

/**
 * What a line of the sheet says about money. Worked out by the system from
 * the salary on record when the sheet is filed, and shown only to people
 * who may know what others earn.
 */
export const OVERTIME_PAY_KEYS = ["salary", "perDay", "perHour", "amount"];

/** Hours between two times of day; an end before the start is past midnight. */
export function hoursBetween(start: string, end: string): string {
  const minutes = (value: string) => {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const from = minutes(start);
  const to = minutes(end);
  if (from === null || to === null || from === to) return "";
  const worked = (to - from + 24 * 60) % (24 * 60);
  return String(round2(worked / 60));
}
