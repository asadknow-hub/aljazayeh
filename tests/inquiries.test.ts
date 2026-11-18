/**
 * The inquiry process: one job followed from the first request to the money
 * being received. Each step has its own answers and its own document number,
 * and nothing moves on until the step is properly filled in.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import { PASSWORD, refused } from "./helpers";
import { getAdminDatabaseUrl } from "@/db/admin-env";
import { authenticateUser } from "@/lib/auth/authenticate";
import { appDateValue } from "@/lib/datetime/format";
import type { StaffRoleKey } from "@/lib/departments/catalog";
import {
  assignInquiryForUser,
  closeInquiryForUser,
  createInquiryForUser,
  getInquiryForUser,
  getInquiryWorkflowMapForUser,
  listInquiriesForUser,
  listInquiryTasksForUser,
  reopenInquiryForUser,
  saveInquiryStageForUser,
  saveInquiryWorkflowMapForUser,
  sendInquiryBackForUser,
} from "@/lib/inquiries/queries";
import { INQUIRY_STAGES } from "@/lib/inquiries/stages";
import type {
  InquiryLineItemInput,
  InquiryView,
} from "@/lib/inquiries/types";
import { createOrganizationForUser } from "@/lib/org/queries";
import {
  createStaffForUser,
  createStaffLoginForUser,
} from "@/lib/staff/queries";

const run = Date.now().toString(36);
const ORG = `inq-${run}`;
const YEAR = appDateValue().slice(0, 4);
const admin = postgres(getAdminDatabaseUrl(), { max: 1 });

let owner: string;
type Person = { userId: string; staffId: string };
const people = {} as Record<"adam" | "amal" | "eli" | "tina", Person>;

async function addPerson(
  fullName: string,
  departmentKeys: StaffRoleKey[],
): Promise<Person> {
  const staff = await createStaffForUser(owner, ORG, {
    fullName,
    email: "",
    phone: "",
    homeCountryContact: "",
    passportNumber: "",
    jobTitle: "",
    employeeCode: "",
    joinedOn: "",
    status: "active",
    notes: "",
    departmentKeys,
  });
  const username = `${fullName.toLowerCase()}.${run}`;
  await createStaffLoginForUser(owner, ORG, staff.id, {
    username,
    password: PASSWORD,
  });
  const login = await authenticateUser(username, PASSWORD);
  assert.ok(login);
  return { userId: login.userId, staffId: staff.id };
}

const item = (
  description: string,
  quantity: string,
  unitPrice = "",
): InquiryLineItemInput => ({
  description,
  quantity,
  unit: "Nos",
  unitPrice,
  deliveredQuantity: "",
});

/** Assign a person to the current step and save it as them. */
async function workStep(
  person: Person,
  inquiryId: string,
  fields: Record<string, string>,
  options: { complete: boolean; lineItems?: InquiryLineItemInput[] },
): Promise<InquiryView> {
  const current = await getInquiryForUser(owner, ORG, inquiryId);
  assert.ok(current);
  if (current.assignedStaffId !== person.staffId) {
    await assignInquiryForUser(owner, ORG, inquiryId, person.staffId);
  }
  return saveInquiryStageForUser(
    person.userId,
    ORG,
    inquiryId,
    { fields, lineItems: options.lineItems ?? current.lineItems },
    { complete: options.complete },
  );
}

before(async () => {
  const [row] =
    await admin`select id from users where is_platform_admin limit 1`;
  assert.ok(row, "run `npm run db:seed` first");
  owner = row.id;

  await createOrganizationForUser(owner, { name: "Step Works", code: ORG });
  people.adam = await addPerson("Adam", ["admin"]);
  people.amal = await addPerson("Amal", ["admin"]);
  people.eli = await addPerson("Eli", ["engineering"]);
  people.tina = await addPerson("Tina", ["accounts"]);

  // Admin sells the job, Engineering builds it, Accounts bills it.
  const map = await getInquiryWorkflowMapForUser(owner, ORG);
  assert.ok(map);
  map.job_card.departmentKey = "engineering";
  for (const stage of [
    "proforma_invoice",
    "progress_invoice",
    "tax_invoice",
    "receipt_voucher",
  ] as const) {
    map[stage].departmentKey = "accounts";
  }
  await saveInquiryWorkflowMapForUser(owner, ORG, map);
});

after(async () => {
  await admin.end();
  await (
    globalThis as { postgresClient?: { end: () => Promise<void> } }
  ).postgresClient?.end();
});

describe("one job from inquiry to payment", () => {
  let inquiryId: string;

  test("a new inquiry gets the next inquiry number", async () => {
    await refused(
      createInquiryForUser(people.adam.userId, ORG, {
        fields: { customerName: " " },
        lineItems: [],
      }),
      /customer's name/,
    );

    const created = await createInquiryForUser(people.adam.userId, ORG, {
      fields: { customerName: "Gulf Marine LLC", contact: "04 555 0100" },
      lineItems: [item("SS handrail", "12")],
    });
    inquiryId = created.id;
    assert.equal(created.number, `${ORG.toUpperCase()}/INQ/${YEAR}/0001`);
    assert.equal(created.status, "open");
    assert.equal(created.steps.length, INQUIRY_STAGES.length);
    assert.deepEqual(
      created.steps.map((step) => step.state),
      ["current", ...Array(INQUIRY_STAGES.length - 1).fill("locked")],
    );

    const second = await createInquiryForUser(people.adam.userId, ORG, {
      fields: { customerName: "Second Customer" },
      lineItems: [],
    });
    assert.equal(second.number, `${ORG.toUpperCase()}/INQ/${YEAR}/0002`);
  });

  test("a step cannot be completed with its required answers missing", async () => {
    await refused(
      workStep(
        people.adam,
        inquiryId,
        { customerName: "Gulf Marine LLC", contact: "04 555 0100" },
        { complete: true },
      ),
      /Fill in before moving on: Inquiry title/,
    );
    await refused(
      workStep(
        people.adam,
        inquiryId,
        { customerName: "Gulf Marine LLC", deliveryExpectedOn: "soon" },
        { complete: false },
      ),
      /not a valid date/,
    );

    const moved = await workStep(
      people.adam,
      inquiryId,
      {
        customerName: "Gulf Marine LLC",
        contact: "04 555 0100",
        title: "Handrail for jetty",
        jobType: "local",
        receivedVia: "phone",
        nonsense: "dropped",
      },
      { complete: true },
    );
    assert.equal(moved.currentStage, "quotation");
    assert.equal(moved.title, "Handrail for jetty");
    assert.equal(moved.steps[0]?.fields.receivedVia, "phone");
    assert.equal(moved.steps[0]?.fields.nonsense, undefined);
    assert.equal(moved.assignedStaffId, null);
  });

  test("the quotation prices the items and gets its own number", async () => {
    const current = await getInquiryForUser(owner, ORG, inquiryId);
    assert.ok(current);
    const fields = {
      quotationDate: "2030-02-01",
      vatPercent: "5",
      discount: "100",
      paymentTerms: "50% advance",
    };

    await assignInquiryForUser(owner, ORG, inquiryId, people.amal.staffId);
    await refused(
      saveInquiryStageForUser(
        people.amal.userId,
        ORG,
        inquiryId,
        { fields, lineItems: [] },
        { complete: true },
      ),
      /at least one priced item/,
    );

    const quoted = await workStep(people.amal, inquiryId, fields, {
      complete: true,
      lineItems: [
        { ...current.lineItems[0]!, unitPrice: "950" },
        item("Installation", "1", "600"),
      ],
    });
    // 12 × 950 + 600 = 12,000; less 100 = 11,900; VAT 595.
    assert.deepEqual(quoted.totals, {
      subtotal: 12000,
      discount: 100,
      vatPercent: 5,
      vat: 595,
      total: 12495,
    });
    assert.equal(
      quoted.steps[1]?.documentNumber,
      `${ORG.toUpperCase()}/QTN/${YEAR}/0001`,
    );
    assert.equal(quoted.currentStage, "lpo_in_or_out");

    const [listed] = (await listInquiriesForUser(owner, ORG)).filter(
      (inquiry) => inquiry.id === inquiryId,
    );
    assert.equal(listed?.totals.total, 12495);
  });

  test("later steps cannot change the quoted items", async () => {
    const saved = await workStep(
      people.adam,
      inquiryId,
      { customerLpoNumber: "LPO-7781", customerLpoDate: "2030-02-03" },
      { complete: false, lineItems: [item("Sneaked in", "1", "1")] },
    );
    assert.equal(saved.lineItems.length, 2);
    assert.equal(saved.totals.total, 12495);
  });

  test("sending back returns the step to the person who handled it", async () => {
    const back = await sendInquiryBackForUser(
      people.adam.userId,
      ORG,
      inquiryId,
      "Customer wants a bigger discount",
    );
    assert.equal(back.currentStage, "quotation");
    assert.equal(back.assignedStaffId, people.amal.staffId);
    assert.equal(back.steps[1]?.state, "current");
    // What was entered on the LPO step is kept for when it comes back.
    assert.equal(back.steps[2]?.state, "locked");

    const again = await workStep(
      people.amal,
      inquiryId,
      { ...back.steps[1]!.fields, discount: "200" },
      { complete: true },
    );
    assert.equal(again.totals.total, 12390);
    assert.equal(
      again.steps[1]?.documentNumber,
      `${ORG.toUpperCase()}/QTN/${YEAR}/0001`,
      "the quotation keeps its number",
    );
    assert.equal(again.assignedStaffId, people.adam.staffId);
    assert.equal(again.steps[2]?.fields.customerLpoNumber, "LPO-7781");
  });

  test("the delivery note records what was delivered", async () => {
    await workStep(
      people.adam,
      inquiryId,
      { customerLpoNumber: "LPO-7781", customerLpoDate: "2030-02-03" },
      { complete: true },
    );
    await workStep(
      people.tina,
      inquiryId,
      { proformaDate: "2030-02-04" },
      { complete: true },
    );
    const jobCard = await workStep(
      people.eli,
      inquiryId,
      {
        startDate: "2030-02-05",
        supervisor: "Hakeem",
        instructions: "Fabricate and polish",
      },
      { complete: true },
    );
    assert.equal(jobCard.owningDepartmentKey, "accounts");
    const progress = await workStep(
      people.tina,
      inquiryId,
      { invoiceDate: "2030-02-10", progressPercent: "50" },
      { complete: true },
    );
    assert.equal(progress.currentStage, "delivery_note");

    const fields = { deliveryDate: "2030-02-20", receivedBy: "Mr. Khan" };
    await refused(
      workStep(people.adam, inquiryId, fields, { complete: true }),
      /delivered quantity for every item/,
    );
    const delivered = await workStep(people.adam, inquiryId, fields, {
      complete: true,
      lineItems: progress.lineItems.map((line) => ({
        ...line,
        // Nothing but the delivered quantity is taken from this step.
        unitPrice: "1",
        deliveredQuantity: line.quantity,
      })),
    });
    assert.equal(delivered.lineItems[0]?.deliveredQuantity, "12");
    assert.equal(delivered.totals.total, 12390);
    assert.equal(delivered.currentStage, "tax_invoice");
  });

  test("the receipt voucher closes the inquiry", async () => {
    await workStep(
      people.tina,
      inquiryId,
      { invoiceDate: "2030-02-21" },
      { complete: true },
    );
    const paid = await workStep(
      people.tina,
      inquiryId,
      {
        receiptDate: "2030-03-01",
        amountReceived: "12390",
        paymentMethod: "bank_transfer",
      },
      { complete: true },
    );
    assert.equal(paid.status, "completed");
    assert.ok(paid.steps.every((step) => step.state === "done"));
    assert.deepEqual(
      paid.steps.map((step) => step.documentNumber.split("/")[1] ?? ""),
      ["INQ", "QTN", "", "PI", "JC", "PRG", "DN", "INV", "RV"],
    );
    assert.equal(paid.canWork, false);
    await refused(
      saveInquiryStageForUser(
        owner,
        ORG,
        inquiryId,
        { fields: {}, lineItems: [] },
        { complete: false },
      ),
      /closed/,
    );
  });
});

describe("managing the work", () => {
  let inquiryId: string;

  before(async () => {
    const created = await createInquiryForUser(people.adam.userId, ORG, {
      fields: { customerName: "Maybe Customer" },
      lineItems: [],
    });
    inquiryId = created.id;
  });

  test("a person's task list shows the inquiries assigned to them", async () => {
    assert.deepEqual(await listInquiryTasksForUser(people.amal.userId, ORG), []);
    await assignInquiryForUser(owner, ORG, inquiryId, people.amal.staffId);
    const tasks = await listInquiryTasksForUser(people.amal.userId, ORG);
    assert.deepEqual(
      tasks.map((task) => [task.inquiry.id, task.reason]),
      [[inquiryId, "assigned"]],
    );
  });

  test("an inquiry that is not going ahead is closed as lost, and can be reopened", async () => {
    await refused(
      closeInquiryForUser(people.adam.userId, ORG, inquiryId, ""),
      /why/,
    );
    const closed = await closeInquiryForUser(
      people.adam.userId,
      ORG,
      inquiryId,
      "Went with another workshop",
    );
    assert.equal(closed.status, "cancelled");
    assert.equal(closed.closeReason, "Went with another workshop");
    assert.deepEqual(await listInquiryTasksForUser(people.amal.userId, ORG), []);
    await refused(
      saveInquiryStageForUser(
        people.amal.userId,
        ORG,
        inquiryId,
        { fields: { customerName: "Maybe Customer" }, lineItems: [] },
        { complete: false },
      ),
      /closed/,
    );

    const reopened = await reopenInquiryForUser(
      people.adam.userId,
      ORG,
      inquiryId,
    );
    assert.equal(reopened.status, "open");
    assert.equal(reopened.currentStage, "inquiry");
  });
});
