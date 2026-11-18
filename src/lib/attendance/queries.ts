import "server-only";

import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { withTenantContext, type DbTransaction } from "@/db/client";
import {
  attendanceRecords,
  organizationSettings,
  staffDepartmentAssignments,
  staffMembers,
  vacationRequests,
} from "@/db/schema";
import { assertCan, can } from "@/lib/access/access";
import {
  attendanceTotals,
  datesOfMonth,
  isAttendanceStatus,
  isIsoDate,
  isIsoMonth,
  isWeeklyOff,
  type AttendanceCell,
  type AttendanceDay,
  type AttendanceGroup,
  type AttendanceMark,
  type AttendanceSheet,
  type AttendanceStatus,
} from "@/lib/attendance/types";
import { appDateValue } from "@/lib/datetime/format";
import { UserError } from "@/lib/errors";
import { requireOrg, resolveOrg } from "@/lib/org/resolve";

type Person = {
  id: string;
  fullName: string;
  jobTitle: string;
  status: string;
  joinedOn: string | null;
  group: AttendanceGroup;
};

/** Everyone on the company's staff list, with the sheet they belong to. */
async function loadPeople(
  tx: DbTransaction,
  organizationId: string,
): Promise<Person[]> {
  const rows = await tx
    .select({
      id: staffMembers.id,
      fullName: staffMembers.fullName,
      jobTitle: staffMembers.jobTitle,
      status: staffMembers.status,
      joinedOn: staffMembers.joinedOn,
      isWorker: sql<boolean>`exists (
        select 1 from ${staffDepartmentAssignments}
        where ${staffDepartmentAssignments.staffId} = ${staffMembers.id}
          and ${staffDepartmentAssignments.departmentKey} = 'workers'
      )`,
    })
    .from(staffMembers)
    .where(eq(staffMembers.organizationId, organizationId))
    .orderBy(asc(staffMembers.fullName));

  return rows.map(({ isWorker, ...person }) => ({
    ...person,
    group: isWorker ? "workers" : "office",
  }));
}

type Period = { from: string; to: string };

/** Entered marks in a period, as staffId → date → status. */
async function loadMarks(
  tx: DbTransaction,
  organizationId: string,
  period: Period,
) {
  const rows = await tx
    .select({
      staffId: attendanceRecords.staffId,
      workDate: attendanceRecords.workDate,
      status: attendanceRecords.status,
    })
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.organizationId, organizationId),
        gte(attendanceRecords.workDate, period.from),
        lte(attendanceRecords.workDate, period.to),
      ),
    );

  const marks = new Map<string, Map<string, AttendanceStatus>>();
  for (const row of rows) {
    if (!isAttendanceStatus(row.status)) continue;
    const byDate = marks.get(row.staffId) ?? new Map();
    byDate.set(row.workDate, row.status);
    marks.set(row.staffId, byDate);
  }
  return marks;
}

/** Approved leave overlapping a period, as staffId → [start, end] ranges. */
async function loadApprovedLeave(
  tx: DbTransaction,
  organizationId: string,
  period: Period,
) {
  const rows = await tx
    .select({
      staffId: vacationRequests.staffId,
      startDate: vacationRequests.startDate,
      endDate: vacationRequests.endDate,
    })
    .from(vacationRequests)
    .where(
      and(
        eq(vacationRequests.organizationId, organizationId),
        eq(vacationRequests.status, "approved"),
        lte(vacationRequests.startDate, period.to),
        gte(vacationRequests.endDate, period.from),
      ),
    );

  const leave = new Map<string, Period[]>();
  for (const row of rows) {
    const ranges = leave.get(row.staffId) ?? [];
    ranges.push({ from: row.startDate, to: row.endDate });
    leave.set(row.staffId, ranges);
  }
  return leave;
}

/** A day that needs no mark: before the person joined, or on approved leave. */
function derivedCell(
  person: Person,
  date: string,
  leave: Period[] | undefined,
): "vacation" | "not_joined" | "" {
  if (person.joinedOn && date < person.joinedOn) return "not_joined";
  if (leave?.some((range) => date >= range.from && date <= range.to)) {
    return "vacation";
  }
  return "";
}

/** The marking screen for one day. */
export async function getAttendanceDayForUser(
  userId: string,
  orgCode: string,
  date: string,
): Promise<AttendanceDay | null> {
  if (!isIsoDate(date)) return null;

  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.useReception(org.access)) return null;

    const period = { from: date, to: date };
    const people = await loadPeople(tx, org.id);
    const marks = await loadMarks(tx, org.id, period);
    const leave = await loadApprovedLeave(tx, org.id, period);

    return {
      date,
      weeklyOff: isWeeklyOff(date),
      rows: people
        // People who have left stay visible on days they were marked.
        .filter((person) => person.status === "active" || marks.has(person.id))
        .map((person) => ({
          staffId: person.id,
          fullName: person.fullName,
          jobTitle: person.jobTitle,
          group: person.group,
          status: marks.get(person.id)?.get(date) ?? "",
          derived: derivedCell(person, date, leave.get(person.id)),
        })),
    };
  });
}

/** Enter, change or clear marks for one day. */
export async function markAttendanceForUser(
  userId: string,
  orgCode: string,
  date: string,
  marks: AttendanceMark[],
): Promise<AttendanceDay> {
  if (!isIsoDate(date)) {
    throw new UserError("Select a valid date.");
  }
  if (date > appDateValue()) {
    throw new UserError("Attendance cannot be marked for a future date.");
  }
  for (const mark of marks) {
    if (mark.status !== "" && !isAttendanceStatus(mark.status)) {
      throw new UserError("Select a valid attendance mark.");
    }
  }

  await withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    assertCan(can.useReception(org.access));

    const people = new Map(
      (await loadPeople(tx, org.id)).map((person) => [person.id, person]),
    );
    for (const mark of marks) {
      const person = people.get(mark.staffId);
      if (!person) throw new UserError("Staff member not found.");
      if (person.joinedOn && date < person.joinedOn) {
        throw new UserError(
          `${person.fullName} had not joined yet on that date.`,
        );
      }
    }

    const cleared = marks.filter((mark) => mark.status === "");
    if (cleared.length > 0) {
      await tx.delete(attendanceRecords).where(
        and(
          eq(attendanceRecords.organizationId, org.id),
          eq(attendanceRecords.workDate, date),
          inArray(
            attendanceRecords.staffId,
            cleared.map((mark) => mark.staffId),
          ),
        ),
      );
    }

    const entered = marks.filter((mark) => mark.status !== "");
    if (entered.length > 0) {
      await tx
        .insert(attendanceRecords)
        .values(
          entered.map((mark) => ({
            organizationId: org.id,
            staffId: mark.staffId,
            workDate: date,
            status: mark.status,
            markedByUserId: userId,
          })),
        )
        .onConflictDoUpdate({
          target: [attendanceRecords.staffId, attendanceRecords.workDate],
          set: {
            status: sql`excluded.status`,
            markedByUserId: userId,
            updatedAt: new Date(),
          },
        });
    }
  });

  const day = await getAttendanceDayForUser(userId, orgCode, date);
  if (!day) throw new UserError("Company not found.");
  return day;
}

/** The monthly Employee Attendance Sheet for the workshop or the office. */
export async function getAttendanceSheetForUser(
  userId: string,
  orgCode: string,
  month: string,
  group: AttendanceGroup,
): Promise<AttendanceSheet | null> {
  if (!isIsoMonth(month)) return null;

  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.useReception(org.access)) return null;

    const dates = datesOfMonth(month);
    const period = { from: dates[0]!, to: dates.at(-1)! };
    const people = await loadPeople(tx, org.id);
    const marks = await loadMarks(tx, org.id, period);
    const leave = await loadApprovedLeave(tx, org.id, period);

    const [settings] = await tx
      .select({ notes: organizationSettings.attendanceSheetNotes })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, org.id))
      .limit(1);

    const rows = people
      .filter((person) => person.group === group)
      // Current staff who had joined by this month, plus anyone marked in it.
      .filter(
        (person) =>
          marks.has(person.id) ||
          (person.status === "active" &&
            (!person.joinedOn || person.joinedOn <= period.to)),
      )
      .map((person) => {
        const cells = dates.map<AttendanceCell>(
          (date) =>
            // A mark wins: someone back early from leave is simply present.
            marks.get(person.id)?.get(date) ??
            derivedCell(person, date, leave.get(person.id)),
        );
        return {
          staffId: person.id,
          fullName: person.fullName,
          cells,
          totals: attendanceTotals(cells),
        };
      });

    return {
      companyName: org.name,
      month,
      dates,
      group,
      rows,
      notes: (settings?.notes ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    };
  });
}
