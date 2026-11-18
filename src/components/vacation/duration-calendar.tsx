"use client";

import { useMemo, useState } from "react";
import { formatFriendlyDate } from "@/lib/datetime/format";
import { vacationDayCountLabel } from "@/lib/vacation/types";

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

type DurationCalendarProps = {
  selectedDates: string[];
  onChange: (dates: string[]) => void;
};

function toIsoDate(year: number, monthIndex: number, day: number): string {
  const month = String(monthIndex + 1).padStart(2, "0");
  const dayText = String(day).padStart(2, "0");
  return `${year}-${month}-${dayText}`;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year: year!, monthIndex: month! - 1, day: day! };
}

function isWeekendIso(iso: string): boolean {
  const { year, monthIndex, day } = parseIsoDate(iso);
  const weekday = new Date(year, monthIndex, day).getDay();
  return weekday === 0 || weekday === 6;
}

function monthLabel(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthIndex, 1));
}

export function DurationCalendar({
  selectedDates,
  onChange,
}: DurationCalendarProps) {
  const initial = selectedDates[0]
    ? parseIsoDate(selectedDates[0])
    : (() => {
        const now = new Date();
        return {
          year: now.getFullYear(),
          monthIndex: now.getMonth(),
          day: now.getDate(),
        };
      })();

  const [cursorYear, setCursorYear] = useState(initial.year);
  const [cursorMonth, setCursorMonth] = useState(initial.monthIndex);

  const selectedSet = useMemo(
    () => new Set(selectedDates),
    [selectedDates],
  );

  const cells = useMemo(() => {
    const first = new Date(cursorYear, cursorMonth, 1);
    const daysInMonth = new Date(cursorYear, cursorMonth + 1, 0).getDate();
    // Monday-first index: Mon=0 ... Sun=6
    const mondayOffset = (first.getDay() + 6) % 7;
    const items: Array<{
      iso: string | null;
      day: number | null;
      weekend: boolean;
    }> = [];

    for (let i = 0; i < mondayOffset; i += 1) {
      items.push({ iso: null, day: null, weekend: false });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = toIsoDate(cursorYear, cursorMonth, day);
      items.push({
        iso,
        day,
        weekend: isWeekendIso(iso),
      });
    }

    while (items.length % 7 !== 0) {
      items.push({ iso: null, day: null, weekend: false });
    }

    return items;
  }, [cursorYear, cursorMonth]);

  const sortedSelected = useMemo(
    () => [...selectedDates].sort(),
    [selectedDates],
  );

  function shiftMonth(delta: number) {
    const next = new Date(cursorYear, cursorMonth + delta, 1);
    setCursorYear(next.getFullYear());
    setCursorMonth(next.getMonth());
  }

  function toggleDate(iso: string) {
    if (selectedSet.has(iso)) {
      onChange(selectedDates.filter((item) => item !== iso).sort());
      return;
    }
    onChange([...selectedDates, iso].sort());
  }

  return (
    <div className="grid grid-cols-1 gap-4 border border-zinc-300 bg-white sm:grid-cols-[minmax(0,1fr)_9.5rem]">
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-700 transition hover:bg-zinc-50"
            aria-label="Previous month"
          >
            ‹
          </button>
          <p className="font-display text-sm font-semibold text-zinc-900">
            {monthLabel(cursorYear, cursorMonth)}
          </p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-700 transition hover:bg-zinc-50"
            aria-label="Next month"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-zinc-500">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} className="py-1">
              {label}
            </span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((cell, index) => {
            if (!cell.iso || cell.day == null) {
              return <span key={`empty-${index}`} className="h-9" />;
            }

            const selected = selectedSet.has(cell.iso);
            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => toggleDate(cell.iso!)}
                title={
                  cell.weekend
                    ? "Weekend — optional, usually left unselected"
                    : formatFriendlyDate(cell.iso)
                }
                className={[
                  "h-9 text-sm transition",
                  selected
                    ? "bg-header text-header-fg"
                    : cell.weekend
                      ? "bg-zinc-50 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                      : "bg-white text-zinc-800 hover:bg-zinc-100",
                  "border border-transparent",
                  selected ? "border-header" : "border-zinc-200",
                ].join(" ")}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Click days one by one. Weekends are optional and usually left
          unselected.
        </p>
      </div>

      <aside className="border-t border-zinc-200 bg-zinc-50 p-3 sm:border-t-0 sm:border-l sm:p-4">
        <p className="text-[12px] font-medium uppercase tracking-wide text-zinc-500">
          Total days
        </p>
        <p className="mt-2 font-display text-2xl font-semibold text-zinc-900">
          {selectedDates.length}
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          {vacationDayCountLabel(selectedDates.length)} selected
        </p>

        {sortedSelected.length > 0 ? (
          <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto text-xs text-zinc-600">
            {sortedSelected.map((iso) => (
              <li key={iso}>{formatFriendlyDate(iso)}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-xs text-zinc-500">No days selected yet.</p>
        )}
      </aside>
    </div>
  );
}
