/**
 * Attendance: daily marking by Reception and the monthly sheet's totals,
 * checked against the counting used on the company's paper sheet.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import { approveLeaveFully, leaveInput, makeSoleSignatory } from "./helpers";
import { getAdminDatabaseUrl } from "@/db/admin-env";
import {
  getAttendanceDayForUser,
  getAttendanceSheetForUser,
  markAttendanceForUser,
} from "@/lib/attendance/queries";
import {
  attendanceTotals,
  isWeeklyOff,
  type AttendanceStatus,
} from "@/lib/attendance/types";
import { datesOfMonth } from "@/lib/datetime/calendar";
import { authenticateUser } from "@/lib/auth/authenticate";
import type { StaffRoleKey } from "@/lib/departments/catalog";
import { UserError } from "@/lib/errors";
import { createOrganizationForUser } from "@/lib/org/queries";
import {
  createStaffForUser,
  createStaffLoginForUser,
  deleteStaffForUser,
} from "@/lib/staff/queries";
import { createVacationRequestForUser } from "@/lib/vacation/queries";

const run = Date.now().toString(36);
const ORG = `att-${run}`;
// A month in the past, so every day can be marked.
const MONTH = "2024-10";
const admin = postgres(getAdminDatabaseUrl(), { max: 1 });

let owner: string;
let receptionist: string;
let salesperson: string;

async function addStaff(
  fullName: string,
  departmentKeys: StaffRoleKey[],
  joinedOn = "",
) {
  return createStaffForUser(owner, ORG, {
    fullName,
    email: "",
    phone: "",
    homeCountryContact: "",
    passportNumber: "",
    jobTitle: "",
    employeeCode: "",
    joinedOn,
    status: "active",
    notes: "",
    departmentKeys,
  });
}

async function addLogin(staffId: string, name: string) {
  const username = `${name}.${run}`;
  await createStaffLoginForUser(owner, ORG, staffId, {
    username,
    password: "correct-horse-battery",
  });
  const login = await authenticateUser(username, "correct-horse-battery");
  assert.ok(login);
  return login.userId;
}

const mark = (date: string, staffId: string, status: AttendanceStatus | "") =>
  markAttendanceForUser(receptionist, ORG, date, [{ staffId, status }]);

const sheetRow = async (staffId: string) => {
  const sheet = await getAttendanceSheetForUser(
    receptionist,
    ORG,
    MONTH,
    "workers",
  );
  assert.ok(sheet);
  const row = sheet.rows.find((item) => item.staffId === staffId);
  assert.ok(row, "person is on the workers sheet");
  return row;
};

before(async () => {
  const [row] =
    await admin`select id from users where is_platform_admin limit 1`;
  assert.ok(row, "run `npm run db:seed` first");
  owner = row.id;
  await createOrganizationForUser(owner, {
    name: "Attendance Works",
    code: ORG,
  });
  const rita = await addStaff("Rita", ["reception"]);
  receptionist = await addLogin(rita.id, "rita");
  // Rita signs every box herself here; the chain has its own tests.
  await makeSoleSignatory(owner, ORG, {
    userId: receptionist,
    staffId: rita.id,
  });
  salesperson = await addLogin((await addStaff("Sam", ["sales"])).id, "sam");
});

after(async () => {
  await admin.end();
  await (
    globalThis as { postgresClient?: { end: () => Promise<void> } }
  ).postgresClient?.end();
});

describe("calendar", () => {
  test("October has 31 days and Fridays are the weekly day off", () => {
    const dates = datesOfMonth("2026-10");
    assert.equal(dates.length, 31);
    assert.deepEqual(dates.filter(isWeeklyOff), [
      "2026-10-02",
      "2026-10-09",
      "2026-10-16",
      "2026-10-23",
      "2026-10-30",
    ]);
    assert.equal(datesOfMonth("2024-02").length, 29);
  });

  test("totals count the way the paper sheet does", () => {
    // Present, Off and MD are present days; a half day is counted apart.
    assert.deepEqual(
      attendanceTotals(["present", "off", "md", "half_day", "absent", ""]),
      { present: 3, absent: 1, half: 1 },
    );
    // Leave and days before joining are absent days.
    assert.deepEqual(attendanceTotals(["vacation", "not_joined"]), {
      present: 0,
      absent: 2,
      half: 0,
    });
  });
});

describe("marking", () => {
  test("only Reception, Management and administrators mark attendance", async () => {
    const worker = await addStaff("Worker One", ["workers"]);
    assert.equal(
      await getAttendanceDayForUser(salesperson, ORG, `${MONTH}-01`),
      null,
    );
    await assert.rejects(
      markAttendanceForUser(salesperson, ORG, `${MONTH}-01`, [
        { staffId: worker.id, status: "present" },
      ]),
      (error: unknown) =>
        error instanceof UserError && /permission/.test(error.message),
    );
    const day = await mark(`${MONTH}-01`, worker.id, "present");
    assert.equal(
      day.rows.find((row) => row.staffId === worker.id)?.status,
      "present",
    );
  });

  test("a mark can be changed and cleared; future dates are refused", async () => {
    const worker = await addStaff("Worker Two", ["workers"]);
    await mark(`${MONTH}-02`, worker.id, "absent");
    await mark(`${MONTH}-02`, worker.id, "half_day");
    assert.deepEqual((await sheetRow(worker.id)).totals, {
      present: 0,
      absent: 0,
      half: 1,
    });
    await mark(`${MONTH}-02`, worker.id, "");
    assert.deepEqual((await sheetRow(worker.id)).totals, {
      present: 0,
      absent: 0,
      half: 0,
    });

    await assert.rejects(
      mark("2999-01-01", worker.id, "present"),
      (error: unknown) =>
        error instanceof UserError && /future/.test(error.message),
    );
    // No marks left, so the mistaken record can still be removed.
    await deleteStaffForUser(owner, ORG, worker.id);
  });

  test("someone with attendance cannot be deleted", async () => {
    const worker = await addStaff("Worker Three", ["workers"]);
    await mark(`${MONTH}-03`, worker.id, "present");
    await assert.rejects(
      deleteStaffForUser(owner, ORG, worker.id),
      (error: unknown) =>
        error instanceof UserError && /Inactive instead/.test(error.message),
    );
  });
});

describe("monthly sheet", () => {
  test("a full month with one absence and one half day", async () => {
    const worker = await addStaff("Full Month", ["workers"]);
    for (const date of datesOfMonth(MONTH)) {
      const status = isWeeklyOff(date)
        ? "off"
        : date === `${MONTH}-07`
          ? "absent"
          : date === `${MONTH}-08`
            ? "half_day"
            : "present";
      await mark(date, worker.id, status);
    }
    assert.deepEqual((await sheetRow(worker.id)).totals, {
      present: 29,
      absent: 1,
      half: 1,
    });
  });

  test("days before the joining date show as New Join and count as absent", async () => {
    const worker = await addStaff("New Joiner", ["workers"], `${MONTH}-10`);
    const row = await sheetRow(worker.id);
    assert.deepEqual(row.cells.slice(0, 10), [
      ...Array(9).fill("not_joined"),
      "",
    ]);
    assert.equal(row.totals.absent, 9);
    await assert.rejects(
      mark(`${MONTH}-05`, worker.id, "present"),
      (error: unknown) =>
        error instanceof UserError && /not joined/.test(error.message),
    );
  });

  test("approved leave fills in as Vacation; a mark on top of it wins", async () => {
    const worker = await addStaff("On Leave", ["workers"]);
    const leave = await createVacationRequestForUser(
      receptionist,
      ORG,
      leaveInput(worker.id, `${MONTH}-19`, `${MONTH}-31`),
    );
    // Pending leave changes nothing.
    assert.equal((await sheetRow(worker.id)).totals.absent, 0);

    await approveLeaveFully(receptionist, ORG, leave.id);
    assert.equal((await sheetRow(worker.id)).totals.absent, 13);

    // Came back a day early.
    await mark(`${MONTH}-31`, worker.id, "present");
    assert.deepEqual((await sheetRow(worker.id)).totals, {
      present: 1,
      absent: 12,
      half: 0,
    });
  });

  test("workers and office staff are on separate sheets", async () => {
    const office = await getAttendanceSheetForUser(
      receptionist,
      ORG,
      MONTH,
      "office",
    );
    const workers = await getAttendanceSheetForUser(
      receptionist,
      ORG,
      MONTH,
      "workers",
    );
    assert.ok(office && workers);
    assert.ok(office.rows.some((row) => row.fullName === "Rita"));
    assert.ok(workers.rows.every((row) => row.fullName !== "Rita"));
    assert.equal(
      await getAttendanceSheetForUser(salesperson, ORG, MONTH, "workers"),
      null,
    );
  });
});
