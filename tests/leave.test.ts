/**
 * Leave requests and the sign-off chain behind them: the form is signed in
 * order by the holders of each position, each confirming with their PIN.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import { PASSWORD, PIN, leaveInput, refused } from "./helpers";
import { getAdminDatabaseUrl } from "@/db/admin-env";
import { authenticateUser } from "@/lib/auth/authenticate";
import type { StaffRoleKey } from "@/lib/departments/catalog";
import { createOrganizationForUser } from "@/lib/org/queries";
import type { PositionKey, SignoffDecision } from "@/lib/signoffs/chains";
import {
  saveSignatureForUser,
  setApprovalPinForUser,
} from "@/lib/signoffs/credentials";
import { setSignatoryForUser } from "@/lib/signoffs/queries";
import {
  createStaffForUser,
  createStaffLoginForUser,
} from "@/lib/staff/queries";
import {
  createVacationRequestForUser,
  getLeaveDocumentForUser,
  listVacationsAwaitingMySignature,
  signVacationRequestForUser,
} from "@/lib/vacation/queries";

const run = Date.now().toString(36);
const ORG = `leave-${run}`;
const admin = postgres(getAdminDatabaseUrl(), { max: 1 });
// A 1x1 transparent PNG stands in for a drawn signature.
const SIGNATURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

let owner: string;
type Person = { userId: string; staffId: string };
const people = {} as Record<
  "rita" | "fahad" | "tina" | "abu" | "didar" | "sam",
  Person
>;
let welderId: string;

async function addStaff(fullName: string, departmentKeys: StaffRoleKey[]) {
  const staff = await createStaffForUser(owner, ORG, {
    fullName,
    email: "",
    phone: "050 111 2222",
    homeCountryContact: "",
    passportNumber: "",
    jobTitle: "",
    employeeCode: "",
    joinedOn: "2024-09-27",
    status: "active",
    notes: "",
    departmentKeys,
  });
  return staff.id;
}

async function addPerson(
  name: string,
  departmentKeys: StaffRoleKey[],
): Promise<Person> {
  const staffId = await addStaff(name, departmentKeys);
  const username = `${name.toLowerCase()}.${run}`;
  await createStaffLoginForUser(owner, ORG, staffId, {
    username,
    password: PASSWORD,
  });
  const login = await authenticateUser(username, PASSWORD);
  assert.ok(login);
  return { userId: login.userId, staffId };
}

const sign = (
  person: Person,
  requestId: string,
  decision: SignoffDecision = "approved",
  remarks = "",
  pin = PIN,
) =>
  signVacationRequestForUser(person.userId, ORG, requestId, {
    pin,
    decision,
    remarks,
  });

const raise = (startDate: string, endDate: string) =>
  createVacationRequestForUser(
    people.rita.userId,
    ORG,
    leaveInput(welderId, startDate, endDate),
  );

before(async () => {
  const [row] =
    await admin`select id from users where is_platform_admin limit 1`;
  assert.ok(row, "run `npm run db:seed` first");
  owner = row.id;
  await createOrganizationForUser(owner, { name: "Leave Works", code: ORG });

  people.rita = await addPerson("Rita", ["reception"]);
  people.fahad = await addPerson("Fahad", ["engineering"]);
  people.tina = await addPerson("Tina", ["accounts"]);
  people.abu = await addPerson("Abu", ["management"]);
  people.didar = await addPerson("Didar", ["management"]);
  people.sam = await addPerson("Sam", ["sales"]);
  welderId = await addStaff("Mahfujur", ["workers"]);
});

after(async () => {
  await admin.end();
  await (
    globalThis as { postgresClient?: { end: () => Promise<void> } }
  ).postgresClient?.end();
});

describe("signatories", () => {
  test("leave cannot be raised until every signing position has a holder", async () => {
    await refused(
      raise("2031-01-05", "2031-01-10"),
      /Nobody is set as Foreman/,
    );
  });

  test("only an administrator names signatories, and only people with a login", async () => {
    await refused(
      setSignatoryForUser(
        people.rita.userId,
        ORG,
        "foreman",
        people.fahad.staffId,
      ),
      /permission/,
    );
    await refused(
      setSignatoryForUser(owner, ORG, "foreman", welderId),
      /with a login/,
    );

    const holders: [PositionKey, Person][] = [
      ["admin", people.rita],
      ["foreman", people.fahad],
      ["purchaser", people.tina],
      ["accountant", people.tina],
      ["managing_partner", people.abu],
      ["managing_director", people.didar],
    ];
    for (const [position, person] of holders) {
      await setSignatoryForUser(owner, ORG, position, person.staffId);
    }
  });
});

describe("signing a leave request", () => {
  let requestId: string;

  before(async () => {
    for (const person of [
      people.fahad,
      people.tina,
      people.abu,
      people.didar,
    ]) {
      await setApprovalPinForUser(person.userId, {
        password: PASSWORD,
        pin: PIN,
      });
    }
    await saveSignatureForUser(people.fahad.userId, SIGNATURE);
  });

  test("raising it fills the form and signs the Prepared By box", async () => {
    const created = await raise("2031-03-05", "2031-05-07");
    requestId = created.id;
    assert.equal(created.dayCount, 64);
    assert.equal(created.returnDate, "2031-05-08");

    const form = await getLeaveDocumentForUser(
      people.rita.userId,
      ORG,
      requestId,
    );
    assert.ok(form);
    assert.equal(form.employee.workingDuration, "6 Years and 5 Months");
    assert.equal(form.employee.previousReturn, "");
    assert.equal(form.employee.department, "Workers");
    assert.equal(form.signoffs.status, "pending");
    assert.equal(form.signoffs.waitingFor, "Forman");
    assert.deepEqual(
      form.signoffs.steps.map((step) => [
        step.label,
        step.expectedName,
        Boolean(step.signed),
      ]),
      [
        ["Prepared By", "Rita", true],
        ["Forman", "Fahad", false],
        ["Signature of Accountant", "Tina", false],
        ["Signature of CEO & Managing Partner", "Abu", false],
        ["Signature of Managing Director", "Didar", false],
      ],
    );
  });

  test("it shows up only for the person whose turn it is", async () => {
    const waiting = async (person: Person) =>
      (await listVacationsAwaitingMySignature(person.userId, ORG)).map(
        (item) => item.id,
      );
    assert.deepEqual(await waiting(people.fahad), [requestId]);
    assert.deepEqual(await waiting(people.tina), []);
    assert.deepEqual(await waiting(people.didar), []);

    // A signatory can open the form even without access to Reception;
    // someone with no part in it cannot.
    assert.ok(
      await getLeaveDocumentForUser(people.fahad.userId, ORG, requestId),
    );
    assert.equal(
      await getLeaveDocumentForUser(people.sam.userId, ORG, requestId),
      null,
    );
  });

  test("nobody signs out of turn or without the right PIN", async () => {
    await refused(sign(people.tina, requestId), /not your turn/);
    await refused(sign(people.sam, requestId), /Set your approval PIN/);
    await refused(
      sign(people.fahad, requestId, "approved", "", "0000"),
      /Wrong PIN/,
    );
    const form = await getLeaveDocumentForUser(
      people.rita.userId,
      ORG,
      requestId,
    );
    assert.equal(form?.signoffs.waitingFor, "Forman");
  });

  test("each signature moves it on; the last one approves it", async () => {
    assert.equal(await sign(people.fahad, requestId), "pending");
    assert.equal(await sign(people.tina, requestId), "pending");
    assert.equal(await sign(people.abu, requestId), "pending");
    assert.equal(await sign(people.didar, requestId), "approved");

    await refused(sign(people.didar, requestId), /already approved/);
  });

  test("the form keeps each signature as it was when signed", async () => {
    // Fahad changes his signature afterwards; the signed form does not.
    await saveSignatureForUser(people.fahad.userId, null);
    const form = await getLeaveDocumentForUser(
      people.rita.userId,
      ORG,
      requestId,
    );
    assert.ok(form);
    assert.equal(form.status, "approved");
    const foreman = form.signoffs.steps[1]!.signed;
    assert.equal(foreman?.name, "Fahad");
    assert.equal(foreman?.signatureImage, SIGNATURE);
    assert.equal(form.signoffs.steps[2]!.signed?.signatureImage, null);
  });

  test("a second leave cannot overlap, and remembers the last return", async () => {
    await refused(
      raise("2031-05-01", "2031-05-20"),
      /already has a leave request/,
    );
    const later = await raise("2031-12-01", "2031-12-10");
    const form = await getLeaveDocumentForUser(
      people.rita.userId,
      ORG,
      later.id,
    );
    assert.equal(form?.employee.previousReturn, "2031-05-08");
  });
});

describe("rejecting", () => {
  test("a rejection needs a reason and ends the request", async () => {
    const request = await raise("2032-02-01", "2032-02-05");
    await sign(people.fahad, request.id);
    await refused(sign(people.tina, request.id, "rejected"), /reason/);
    assert.equal(
      await sign(people.tina, request.id, "rejected", "Month-end closing"),
      "rejected",
    );
    await refused(sign(people.abu, request.id), /already rejected/);

    // The days are free again for a new request.
    await raise("2032-02-01", "2032-02-05");
  });

  test("five wrong PINs lock the PIN until a new one is set", async () => {
    const request = await raise("2032-06-01", "2032-06-02");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await refused(
        sign(people.fahad, request.id, "approved", "", "9999"),
        /Wrong PIN/,
      );
    }
    await refused(sign(people.fahad, request.id), /PIN is locked/);
    await setApprovalPinForUser(people.fahad.userId, {
      password: PASSWORD,
      pin: PIN,
    });
    assert.equal(await sign(people.fahad, request.id), "pending");
  });
});
