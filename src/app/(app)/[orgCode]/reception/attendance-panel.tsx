"use client";

import Link from "next/link";
import { useState } from "react";
import { unwrap } from "@/lib/actions/result";
import {
  getAttendanceDayAction,
  markAttendanceAction,
} from "@/lib/attendance/actions";
import {
  ATTENDANCE_GROUPS,
  ATTENDANCE_STATUSES,
  type AttendanceDay,
  type AttendanceDayRow,
  type AttendanceMark,
  type AttendanceStatus,
} from "@/lib/attendance/types";
import { formatFriendlyDate } from "@/lib/datetime/format";
import { useServerState } from "@/lib/react/use-server-state";

type AttendancePanelProps = {
  orgCode: string;
  /** Today's date in Dubai; later dates cannot be marked. */
  today: string;
  initialDay: AttendanceDay;
};

const DERIVED_LABEL = {
  vacation: "On approved vacation",
  not_joined: "Not joined yet",
} as const;

/** Reception marks who is in, day by day. */
export function AttendancePanel({
  orgCode,
  today,
  initialDay,
}: AttendancePanelProps) {
  const [day, setDay] = useServerState(initialDay);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(work: () => Promise<AttendanceDay>) {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      setDay(await work());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  const changeDate = (date: string) =>
    run(() => unwrap(getAttendanceDayAction(orgCode, date)));

  const mark = (marks: AttendanceMark[]) =>
    run(() => unwrap(markAttendanceAction(orgCode, day.date, marks)));

  // People who still need a mark today.
  const unmarked = day.rows.filter((row) => !row.status && !row.derived);
  const fillStatus: AttendanceStatus = day.weeklyOff ? "off" : "present";
  const fillLabel = ATTENDANCE_STATUSES.find(
    (status) => status.key === fillStatus,
  )!.label;

  return (
    <div className="w-full max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-zinc-900">
            Attendance
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            {formatFriendlyDate(day.date)}
            {day.weeklyOff ? " · weekly day off" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={day.date}
            max={today}
            disabled={pending}
            onChange={(event) => {
              if (event.target.value) void changeDate(event.target.value);
            }}
            aria-label="Date"
            className="border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-header"
          />
          <Link
            href={`/${orgCode}/reception/attendance?month=${day.date.slice(0, 7)}`}
            className="border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Monthly sheet
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-zinc-300 bg-white px-4 py-3">
        <p className="text-sm text-zinc-700">
          {unmarked.length === 0
            ? "Everyone is marked for this day."
            : `${unmarked.length} not marked yet.`}
        </p>
        <button
          type="button"
          disabled={pending || unmarked.length === 0}
          onClick={() =>
            mark(
              unmarked.map((row) => ({
                staffId: row.staffId,
                status: fillStatus,
              })),
            )
          }
          className="bg-header px-3 py-1.5 text-sm font-medium text-header-fg transition hover:bg-header-control disabled:cursor-not-allowed disabled:opacity-45"
        >
          Mark the rest {fillLabel}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {ATTENDANCE_GROUPS.map((group) => {
        const rows = day.rows.filter((row) => row.group === group.key);
        if (rows.length === 0) return null;
        return (
          <section key={group.key} className="mt-5">
            <h3 className="font-display text-sm font-semibold text-zinc-900">
              {group.label} ({rows.length})
            </h3>
            <ul className="mt-2 divide-y divide-zinc-200 border border-zinc-300 bg-white">
              {rows.map((row) => (
                <AttendanceRow
                  key={row.staffId}
                  row={row}
                  disabled={pending}
                  onMark={(status) => mark([{ staffId: row.staffId, status }])}
                />
              ))}
            </ul>
          </section>
        );
      })}

      {day.rows.length === 0 ? (
        <p className="mt-5 border border-zinc-300 bg-white px-4 py-5 text-sm text-zinc-600">
          No staff yet. Add people under Staff first.
        </p>
      ) : null}
    </div>
  );
}

function AttendanceRow({
  row,
  disabled,
  onMark,
}: {
  row: AttendanceDayRow;
  disabled: boolean;
  onMark: (status: AttendanceStatus | "") => void;
}) {
  const notJoined = row.derived === "not_joined";

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-900">
          {row.fullName}
        </p>
        <p className="truncate text-xs text-zinc-500">
          {[
            row.jobTitle,
            row.derived && !row.status && DERIVED_LABEL[row.derived],
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div
        className="flex shrink-0 gap-1"
        role="group"
        aria-label={row.fullName}
      >
        {ATTENDANCE_STATUSES.map((status) => {
          const active = row.status === status.key;
          return (
            <button
              key={status.key}
              type="button"
              title={status.label}
              aria-pressed={active}
              disabled={disabled || notJoined}
              // Pressing the current mark again clears it.
              onClick={() => onMark(active ? "" : status.key)}
              className={[
                "min-w-11 border px-2 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
                active
                  ? "border-header bg-header text-header-fg"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100",
              ].join(" ")}
            >
              {status.code}
            </button>
          );
        })}
      </div>
    </li>
  );
}
