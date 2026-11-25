/**
 * The signed internal forms: fine notice, medical amount, petty cash,
 * material request, verbal work approval and the daily overtime sheet. They
 * share one mechanism, so each test checks what is particular to a form.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import { namePositions, PASSWORD, PIN, refused } from "./helpers";
import { getAdminDatabaseUrl } from "@/db/admin-env";
import { authenticateUser } from "@/lib/auth/authenticate";
import { appDateValue } from "@/lib/datetime/format";
import type { StaffRoleKey } from "@/lib/departments/catalog";
import type { ApprovalFormInput, FormType } from "@/lib/forms/definitions";
import { hoursBetween } from "@/lib/forms/overtime";
import { printedForm } from "@/lib/forms/print";
import {
  createApprovalFormForUser,
  getApprovalFormDocumentForUser,
  listApprovalFormsForUser,
  listFormsAwaitingMySignature,
  signApprovalFormForUser,
} from "@/lib/forms/queries";
import { createOrganizationForUser } from "@/lib/org/queries";
import { setApprovalPinForUser } from "@/lib/signoffs/credentials";
import {
  createStaffForUser,
  createStaffLoginForUser,
  updateStaffSalaryForUser,
} from "@/lib/staff/queries";

const run = Date.now().toString(36);
const ORG = `forms-${run}`;
const YEAR = appDateValue().slice(0, 4);
const admin = postgres(getAdminDatabaseUrl(), { max: 1 });

let owner: string;
type Person = { userId: string; staffId: string };
const people = {} as Record<
  "rita" | "rameez" | "fahad" | "tina" | "abu" | "didar" | "sam",
  Person
>;
let welderId: string;

async function addStaff(fullName: string, departmentKeys: StaffRoleKey[]) {
  const staff = await createStaffForUser(owner, ORG, {
    fullName,
    email: "",
    phone: "",
    homeCountryContact: "",
    passportNumber: "",
    jobTitle: departmentKeys[0] === "accounts" ? "Accountant" : "",
    employeeCode: "",
    joinedOn: "",
    status: "active",
    notes: "",
    departmentKeys,
  });
  return staff.id;
}

async function addPerson(name: string, departmentKeys: StaffRoleKey[]) {
  const staffId = await addStaff(name, departmentKeys);
  const username = `${name.toLowerCase()}.${run}`;
  await createStaffLoginForUser(owner, ORG, staffId, {
    username,
    password: PASSWORD,
  });
  const login = await authenticateUser(username, PASSWORD);
  assert.ok(login);
  await setApprovalPinForUser(login.userId, { password: PASSWORD, pin: PIN });
  return { userId: login.userId, staffId };
}

const raise = (
  person: Person,
  type: FormType,
  input: Partial<ApprovalFormInput>,
) =>
  createApprovalFormForUser(person.userId, ORG, type, {
    staffId: "",
    fields: {},
    lines: [],
    ...input,
  });

const approve = (person: Person, formId: string, remarks = "") =>
  signApprovalFormForUser(person.userId, ORG, formId, {
    pin: PIN,
    decision: "approved",
    remarks,
  });

const document = async (person: Person, formId: string) => {
  const form = await getApprovalFormDocumentForUser(person.userId, ORG, formId);
  assert.ok(form, "the form is visible to this person");
  return form;
};

before(async () => {
  const [row] =
    await admin`select id from users where is_platform_admin limit 1`;
  assert.ok(row, "run `npm run db:seed` first");
  owner = row.id;
  await createOrganizationForUser(owner, { name: "Forms Works", code: ORG });

  people.rita = await addPerson("Rita", ["reception"]);
  people.rameez = await addPerson("Rameez", ["admin"]);
  people.fahad = await addPerson("Fahad", ["engineering"]);
  people.tina = await addPerson("Tina", ["accounts"]);
  people.abu = await addPerson("Abu", ["management"]);
  people.didar = await addPerson("Didar", ["management"]);
  people.sam = await addPerson("Sam", ["sales"]);
  welderId = await addStaff("Khairul Islam", ["workers"]);

  await namePositions(owner, ORG, {
    Admin: people.rameez,
    Foreman: people.fahad,
    Purchaser: people.rameez,
    Accountant: people.tina,
    "CEO & Managing Partner": people.abu,
    "Managing Director": people.didar,
  });
});

after(async () => {
  await admin.end();
  await (
    globalThis as { postgresClient?: { end: () => Promise<void> } }
  ).postgresClient?.end();
});

describe("fine notice", () => {
  let formId: string;

  test("reception raises it about an employee; it gets a running number", async () => {
    await refused(
      raise(people.sam, "fine_notice", { staffId: welderId }),
      /Fine \(AED\) is required|What happened/,
    );
    await refused(
      raise(people.sam, "fine_notice", {
        staffId: welderId,
        fields: { reason: "been late", amount: "50" },
      }),
      /permission/,
    );
    await refused(
      raise(people.rita, "fine_notice", {
        fields: { reason: "been late", amount: "50" },
      }),
      /Select an employee/,
    );

    const first = await raise(people.rita, "fine_notice", {
      staffId: welderId,
      fields: {
        reason: "come to office without informing your Forman",
        amount: "50",
      },
    });
    formId = first.id;
    assert.equal(first.referenceNo, `FN/${YEAR}/0001`);
    assert.equal(first.amount, "50.00");
    assert.equal(first.staffName, "Khairul Islam");

    const second = await raise(people.rita, "fine_notice", {
      staffId: welderId,
      fields: { reason: "been late", amount: "25" },
    });
    assert.equal(second.referenceNo, `FN/${YEAR}/0002`);
  });

  test("it prints as the company's letter with a box for the employee", async () => {
    const printed = printedForm(await document(people.rita, formId));
    assert.equal(printed.letter[0], "Dear Khairul Islam,");
    assert.match(printed.letter[2]!, /fine of AED-50\/- .* Forms Works\.$/);
    assert.equal(printed.employeeBox, "FINE ISSUED TO KHAIRUL ISLAM");
    assert.equal(printed.managingRemarks, true);
  });

  test("Admin, Accounts, Managing Partner and Managing Director sign in turn", async () => {
    const waiting = async (person: Person) =>
      (await listFormsAwaitingMySignature(person.userId, ORG)).some(
        (form) => form.id === formId,
      );
    assert.equal(await waiting(people.rameez), true);
    assert.equal(await waiting(people.tina), false);
    await refused(approve(people.tina, formId), /not your turn/);

    assert.equal(await approve(people.rameez, formId), "pending");
    assert.equal(await approve(people.tina, formId), "pending");
    assert.equal(await approve(people.abu, formId, "Final warning"), "pending");
    assert.equal(await approve(people.didar, formId), "approved");

    const form = await document(people.rita, formId);
    assert.equal(form.status, "approved");
    assert.deepEqual(
      form.signoffs.steps.map((step) => step.signed?.name),
      ["Rameez", "Tina", "Abu", "Didar"],
    );
    assert.equal(form.signoffs.steps[2]!.signed?.remarks, "Final warning");
  });

  test("people with no part in it cannot open it", async () => {
    assert.equal(
      await getApprovalFormDocumentForUser(people.sam.userId, ORG, formId),
      null,
    );
    assert.deepEqual(
      await listApprovalFormsForUser(people.sam.userId, ORG, "fine_notice"),
      [],
    );
    // A signatory outside Reception can.
    assert.ok(
      await getApprovalFormDocumentForUser(people.tina.userId, ORG, formId),
    );
  });
});

describe("medical amount", () => {
  test("the company pays 70% and the employee 30%", async () => {
    const created = await raise(people.rita, "medical_claim", {
      staffId: welderId,
      fields: {
        date: "2026-11-05",
        hospital: "Prestine Pharmacy LLC",
        total: "26.5",
      },
    });
    const printed = printedForm(await document(people.rita, created.id));
    assert.deepEqual(printed.table?.rows[0], [
      "05-11-2026",
      "KHAIRUL ISLAM",
      "Prestine Pharmacy LLC",
      "18.55",
      "7.95",
      "26.50",
    ]);
    assert.equal(printed.employeeBox, "MEDICAL AMOUNT PAID TO KHAIRUL ISLAM");
    // Accounts is the first to sign.
    assert.equal(await approve(people.tina, created.id), "pending");
  });

  test("dates and amounts are checked", async () => {
    await refused(
      raise(people.rita, "medical_claim", {
        staffId: welderId,
        fields: { date: "2026-02-31", hospital: "Clinic", total: "10" },
      }),
      /not a valid date/,
    );
    await refused(
      raise(people.rita, "medical_claim", {
        staffId: welderId,
        fields: { date: "2026-02-01", hospital: "Clinic", total: "ten" },
      }),
      /must be a number/,
    );
  });
});

describe("petty cash", () => {
  test("accounts raises it; lines are totalled and the preparer's box is signed", async () => {
    await refused(
      raise(people.rita, "petty_cash", {
        fields: { projectName: "General", requestDate: "2026-09-01" },
        lines: [{ description: "Food", invoiceAmount: "7" }],
      }),
      /permission/,
    );
    await refused(
      raise(people.tina, "petty_cash", {
        fields: { projectName: "General", requestDate: "2026-09-01" },
        lines: [{}],
      }),
      /at least one line/,
    );
    await refused(
      raise(people.tina, "petty_cash", {
        fields: { projectName: "General", requestDate: "2026-09-01" },
        lines: [{ description: "Food" }],
      }),
      /Line 1: Invoices amount/,
    );

    const created = await raise(people.tina, "petty_cash", {
      fields: { projectName: "GENERAL PETTY CASH", requestDate: "2026-09-01" },
      lines: [
        {
          paidBy: "Hakeem",
          foodFor: "Freezone staff",
          description: "Food",
          invoiceQty: "1",
          invoiceAmount: "7",
        },
        {
          paidBy: "Hakeem",
          description: "Food",
          invoiceQty: "1",
          invoiceAmount: "20",
        },
        {
          paidBy: "Razel",
          vehicleNo: "Petrol can",
          description: "Petrol expenses",
          invoiceQty: "1",
          invoiceAmount: "200",
        },
        {
          paidBy: "Razel",
          description: "Key bolt",
          invoiceQty: "1",
          invoiceAmount: "7.77",
        },
        {},
      ],
    });
    assert.equal(created.amount, "234.77");

    const form = await document(people.tina, created.id);
    assert.equal(form.lines.length, 4, "the empty row is dropped");
    assert.equal(form.signoffs.steps[0]!.signed?.name, "Tina");
    assert.equal(form.signoffs.waitingFor, "Verified by Accounts");
    const printed = printedForm(form);
    assert.deepEqual(printed.table?.totals?.slice(-2), ["4", "234.77"]);
    assert.ok(
      printed.details.some(
        ([label, value]) =>
          label === "DESIGNATION" && value === "TINA ( ACCOUNTANT )",
      ),
    );
  });
});

describe("material request", () => {
  test("engineering raises it; it starts with the Foreman", async () => {
    await refused(
      raise(people.rita, "material_request", {
        fields: { projectName: "AC gas", requestDate: "2026-08-03" },
        lines: [{ materialDescription: "AC gas", qty: "1" }],
      }),
      /permission/,
    );
    const created = await raise(people.fahad, "material_request", {
      fields: { projectName: "AC GAS", requestDate: "2026-08-03" },
      lines: [{ materialDescription: "AC gas ( Refron )", qty: "1" }],
    });
    assert.equal(created.referenceNo, `MRAF/${YEAR}/0001`);
    assert.equal(created.amount, null);
    const form = await document(people.fahad, created.id);
    assert.equal(form.signoffs.waitingFor, "Verified by Forman");
    assert.equal(form.signoffs.steps.length, 5);
  });
});

describe("verbal work approval", () => {
  test("the admin department raises it; VAT is added to the job price", async () => {
    const created = await raise(people.rameez, "verbal_work_approval", {
      fields: {
        projectName: "GI GALV PIPE",
        requestedBy: "Mr. Nazmul",
        customerName: "Barton Engineering",
        requestDate: "2026-10-29",
      },
      lines: [
        {
          approvedBy: "Arbab",
          materialDescription: 'GI galv pipe 1" 300 mm length SCH STD',
          qty: "28",
          jobPrice: "25",
        },
      ],
    });
    // The sample form: 28 × 25 = 700, VAT 35, total 735.
    assert.equal(created.amount, "735.00");
    const printed = printedForm(await document(people.rameez, created.id));
    assert.deepEqual(printed.table?.rows[0]?.slice(3, 8), [
      "28",
      "25.00",
      "700.00",
      "35.00",
      "735.00",
    ]);
  });
});

describe("daily overtime sheet", () => {
  let formId: string;
  let helperId: string;
  const salary = (staffId: string, salaryAmount: string) =>
    updateStaffSalaryForUser(owner, ORG, staffId, {
      salaryAmount,
      salaryCurrency: "AED",
      payFrequency: "monthly",
      lastSalaryPaidOn: "",
      salaryNotes: "",
    });

  before(async () => {
    helperId = await addStaff("Jubair", ["workers"]);
    await salary(welderId, "1800");
    // The helper has no salary on record yet.
  });

  test("the hours follow the start and end time, also past midnight", () => {
    assert.equal(hoursBetween("18:00", "21:00"), "3");
    assert.equal(hoursBetween("17:30", "19:00"), "1.5");
    assert.equal(hoursBetween("22:00", "01:30"), "3.5");
    assert.equal(hoursBetween("18:00", ""), "");
  });

  test("reception files one sheet for the day; a person is on it once, with hours", async () => {
    const line = { staffId: welderId, hours: "3" };
    await refused(
      raise(people.sam, "overtime", {
        fields: { date: "2026-11-24" },
        lines: [line],
      }),
      /permission/,
    );
    await refused(
      raise(people.rita, "overtime", { fields: {}, lines: [line] }),
      /Day the overtime was worked is required/,
    );
    await refused(
      raise(people.rita, "overtime", {
        fields: { date: "2026-11-24" },
        lines: [line, { ...line, hours: "1" }],
      }),
      /on the sheet twice/,
    );
    await refused(
      raise(people.rita, "overtime", {
        fields: { date: "2026-11-24" },
        lines: [{ staffId: welderId, hours: "0" }],
      }),
      /how many hours of overtime Khairul Islam worked/,
    );
    await refused(
      raise(people.rita, "overtime", {
        fields: { date: "2026-11-24" },
        lines: [{ staffId: welderId, hours: "2", startTime: "6pm" }],
      }),
      /Start time is not a valid time/,
    );

    const created = await raise(people.rita, "overtime", {
      fields: { date: "2026-11-24", food: "30" },
      lines: [
        {
          staffId: welderId,
          startTime: "18:00",
          endTime: "21:00",
          hours: "3",
          jobProgress: "Welding stringers",
          clientName: "Barton Engineering",
          // What the form shows while typing is not taken at its word.
          name: "Someone Else",
          amount: "9999",
        },
        { staffId: helperId, hours: "2" },
      ],
    });
    formId = created.id;
    assert.equal(created.referenceNo, `OT/${YEAR}/0001`);
    assert.match(created.summary, /2 people$/);
    // Reception files it but is not shown what people earn.
    assert.equal(created.amount, null);
  });

  test("pay is the salary over 30 days and 9 hours, shown to Accounts and the owners only", async () => {
    // 1800 / 30 = 60 a day, / 9 = 6.67 an hour, x 3 hours = 20.01.
    const forAccounts = await document(people.tina, formId);
    assert.equal(forAccounts.amount, "50.01");
    assert.deepEqual(
      forAccounts.lines.map((line) => [
        line.name,
        line.salary,
        line.perDay,
        line.perHour,
        line.amount,
      ]),
      [
        ["Khairul Islam", "1800.00", "60.00", "6.67", "20.01"],
        ["Jubair", "0.00", "0.00", "0.00", "0.00"],
      ],
    );
    const printed = printedForm(forAccounts);
    assert.equal(printed.table?.columns.length, 12);
    assert.deepEqual(printed.table?.rows[0]?.slice(1, 5), [
      forAccounts.lines[0]!.employeeId,
      "Khairul Islam",
      "6:00 PM",
      "9:00 PM",
    ]);
    // Someone with no salary on record is pointed out, not paid nothing.
    assert.equal(printed.table?.rows[1]?.at(-1), "NO SALARY ON RECORD");
    assert.deepEqual(printed.table?.rows[2]?.slice(2, 3), ["FOOD"]);
    assert.equal(printed.table?.rows[2]?.at(-1), "30.00");
    assert.equal(printed.table?.totals?.at(-1), "50.01");
    assert.equal(printed.table?.totals?.[7], "5");

    const forReception = await document(people.rita, formId);
    assert.equal(forReception.amount, null);
    assert.ok(forReception.lines.every((line) => line.amount === undefined));
    assert.ok(forReception.lines.every((line) => line.salary === undefined));
    assert.equal(forReception.lines[0]!.hours, "3");
    assert.equal(printedForm(forReception).table?.columns.length, 8);
    const listed = await listApprovalFormsForUser(
      people.rita.userId,
      ORG,
      "overtime",
    );
    assert.deepEqual(
      listed.map((form) => form.amount),
      [null],
    );
  });

  test("the owners approve it, then the accountant clears it for payout", async () => {
    const start = await document(people.abu, formId);
    assert.deepEqual(
      start.signoffs.steps.map((step) => step.label),
      [
        "Prepared By",
        "Approved by CEO & Managing Partner",
        "Approved by Managing Director",
        "Cleared by Accountant",
      ],
    );
    await refused(
      approve(people.tina, formId),
      /not your turn|cannot sign|turn/i,
    );
    assert.equal(await approve(people.abu, formId), "pending");
    assert.equal(await approve(people.didar, formId), "pending");
    const waiting = await listFormsAwaitingMySignature(people.tina.userId, ORG);
    assert.ok(waiting.some((form) => form.id === formId));
    assert.equal(
      await approve(people.tina, formId, "Paid in cash"),
      "approved",
    );

    // A later change of salary does not change a sheet already filed.
    await salary(welderId, "3600");
    assert.equal((await document(people.tina, formId)).amount, "50.01");
  });
});
