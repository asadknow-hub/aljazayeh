/**
 * What a paper prints about the company beyond its fixed details: one of
 * its bank accounts, kept by Accounts, and one of the names it trades
 * under. Also the employee IDs, which every employee has.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import { PASSWORD, refused } from "./helpers";
import { getAdminDatabaseUrl } from "@/db/admin-env";
import { authenticateUser } from "@/lib/auth/authenticate";
import {
  addBankAccountForUser,
  listBankAccountsForUser,
  removeBankAccountForUser,
  setDefaultBankAccountForUser,
  updateBankAccountForUser,
} from "@/lib/banks/queries";
import type { BankAccountInput } from "@/lib/banks/types";
import {
  getCompanyLetterheadForUser,
  removeLetterheadForUser,
  saveLetterheadForUser,
} from "@/lib/company-settings/queries";
import type { StaffRoleKey } from "@/lib/departments/catalog";
import {
  assignInquiryForUser,
  createInquiryForUser,
  getInquiryForUser,
  saveInquiryStageForUser,
} from "@/lib/inquiries/queries";
import type { InquiryStageKey } from "@/lib/inquiries/stages";
import type { InquiryView } from "@/lib/inquiries/types";
import { createOrganizationForUser } from "@/lib/org/queries";
import {
  createStaffForUser,
  createStaffLoginForUser,
  getStaffForUser,
  listStaffForUser,
  updateStaffProfileForUser,
} from "@/lib/staff/queries";
import type { StaffProfileInput } from "@/lib/staff/types";

const run = Date.now().toString(36);
const ORG = `bank-${run}`;
const admin = postgres(getAdminDatabaseUrl(), { max: 1 });

let owner: string;
type Person = { userId: string; staffId: string };
const people = {} as Record<"adam" | "tina", Person>;

const profile = (
  fullName: string,
  departmentKeys: StaffRoleKey[],
  employeeCode = "",
): StaffProfileInput => ({
  fullName,
  email: "",
  phone: "",
  homeCountryContact: "",
  passportNumber: "",
  jobTitle: "",
  employeeCode,
  joinedOn: "",
  status: "active",
  notes: "",
  departmentKeys,
});

async function addPerson(
  fullName: string,
  departmentKeys: StaffRoleKey[],
): Promise<Person> {
  const staff = await createStaffForUser(
    owner,
    ORG,
    profile(fullName, departmentKeys),
  );
  const username = `${fullName.toLowerCase()}.${run}`;
  await createStaffLoginForUser(owner, ORG, staff.id, {
    username,
    password: PASSWORD,
  });
  const login = await authenticateUser(username, PASSWORD);
  assert.ok(login);
  return { userId: login.userId, staffId: staff.id };
}

const account = (
  bankName: string,
  rest: Partial<BankAccountInput> = {},
): BankAccountInput => ({
  label: "",
  bankName,
  accountName: "STEP WORKS LLC",
  accountNumber: "1234567890",
  iban: "",
  swift: "",
  branch: "",
  ...rest,
});

const step = (inquiry: InquiryView, key: InquiryStageKey) =>
  inquiry.steps.find((item) => item.key === key)!;

before(async () => {
  const [row] =
    await admin`select id from users where is_platform_admin limit 1`;
  assert.ok(row, "run `npm run db:seed` first");
  owner = row.id;

  await createOrganizationForUser(owner, { name: "Bank Works", code: ORG });
  people.adam = await addPerson("Adam", ["admin"]);
  people.tina = await addPerson("Tina", ["accounts"]);
});

after(async () => {
  await admin.end();
  await (
    globalThis as { postgresClient?: { end: () => Promise<void> } }
  ).postgresClient?.end();
});

describe("the company's bank accounts", () => {
  test("Accounts keeps them; other departments do not", async () => {
    await refused(
      addBankAccountForUser(people.adam.userId, ORG, account("First Bank")),
      /permission/,
    );
    assert.deepEqual(
      await listBankAccountsForUser(people.adam.userId, ORG),
      [],
    );
  });

  test("the first account is the one papers start with", async () => {
    const one = await addBankAccountForUser(
      people.tina.userId,
      ORG,
      account("  First   Bank "),
    );
    assert.equal(one.length, 1);
    // Named after the bank when no name is typed.
    assert.equal(one[0]!.label, "First Bank");
    assert.equal(one[0]!.isDefault, true);

    const two = await addBankAccountForUser(
      people.tina.userId,
      ORG,
      account("Second Bank", { label: "Second Bank, AED", iban: "AE07" }),
    );
    assert.deepEqual(
      two.map((item) => [item.label, item.isDefault]),
      [
        ["First Bank", true],
        ["Second Bank, AED", false],
      ],
    );
  });

  test("an account needs a bank, a number and a name of its own", async () => {
    await refused(
      addBankAccountForUser(people.tina.userId, ORG, account("")),
      /bank's name/,
    );
    await refused(
      addBankAccountForUser(
        people.tina.userId,
        ORG,
        account("Third Bank", { accountNumber: "", iban: "" }),
      ),
      /account number or the IBAN/,
    );
    await refused(
      addBankAccountForUser(people.tina.userId, ORG, account("first bank")),
      /already an account called/,
    );
  });

  test("another account can be made the one papers start with", async () => {
    const accounts = await listBankAccountsForUser(people.tina.userId, ORG);
    const second = accounts.find((item) => item.bankName === "Second Bank")!;
    const after = await setDefaultBankAccountForUser(
      people.tina.userId,
      ORG,
      second.id,
    );
    assert.deepEqual(
      after.map((item) => [item.bankName, item.isDefault]),
      [
        ["Second Bank", true],
        ["First Bank", false],
      ],
    );
  });
});

describe("the bank account on a paper", () => {
  let inquiryId: string;
  let firstId: string;
  let secondId: string;

  /** Save the current step as Adam, who is given it first. */
  async function work(
    fields: Record<string, string>,
    complete: boolean,
  ): Promise<InquiryView> {
    const current = await getInquiryForUser(owner, ORG, inquiryId);
    assert.ok(current);
    if (current.assignedStaffId !== people.adam.staffId) {
      await assignInquiryForUser(owner, ORG, inquiryId, people.adam.staffId);
    }
    return saveInquiryStageForUser(
      people.adam.userId,
      ORG,
      inquiryId,
      { fields, lineItems: current.lineItems },
      { complete },
    );
  }

  before(async () => {
    const accounts = await listBankAccountsForUser(people.tina.userId, ORG);
    firstId = accounts.find((item) => item.bankName === "First Bank")!.id;
    secondId = accounts.find((item) => item.bankName === "Second Bank")!.id;

    const created = await createInquiryForUser(people.adam.userId, ORG, {
      fields: {
        customerName: "Paying Customer LLC",
        title: "Gate",
        contact: "1",
      },
      lineItems: [
        {
          description: "Gate",
          quantity: "1",
          unit: "Nos",
          unitPrice: "900",
          deliveredQuantity: "",
          details: {},
        },
      ],
    });
    inquiryId = created.id;
    const opened = await getInquiryForUser(people.adam.userId, ORG, inquiryId);
    await work(step(opened!, "inquiry").fields, true);
  });

  test("whoever prepares the paper is offered the company's accounts", async () => {
    const inquiry = await getInquiryForUser(people.adam.userId, ORG, inquiryId);
    assert.deepEqual(
      inquiry!.bankAccounts.map((item) => item.bankName),
      ["Second Bank", "First Bank"],
    );
    assert.equal(step(inquiry!, "quotation").bank, null);
  });

  test("the chosen account's details are saved with the paper", async () => {
    const saved = await work(
      {
        quotationDate: "2026-11-23",
        vatPercent: "5",
        termPayment: "Cash",
        bankAccount: firstId,
      },
      false,
    );
    assert.deepEqual(step(saved, "quotation").bank, {
      bankName: "First Bank",
      accountName: "STEP WORKS LLC",
      accountNumber: "1234567890",
      iban: "",
      swift: "",
      branch: "",
    });
  });

  test("an account that is not the company's is refused", async () => {
    await refused(
      work(
        {
          quotationDate: "2026-11-23",
          vatPercent: "5",
          termPayment: "Cash",
          bankAccount: crypto.randomUUID(),
        },
        false,
      ),
      /no longer in use/,
    );
    await refused(
      work(
        {
          quotationDate: "2026-11-23",
          vatPercent: "5",
          termPayment: "Cash",
          bankAccount: "the big one",
        },
        false,
      ),
      /Choose the bank account again/,
    );
  });

  test("a paper can be saved without bank details", async () => {
    const saved = await work(
      {
        quotationDate: "2026-11-23",
        vatPercent: "5",
        termPayment: "Cash",
        bankAccount: "",
      },
      false,
    );
    assert.equal(step(saved, "quotation").bank, null);
  });

  test("a finished paper keeps the account it was issued with", async () => {
    const finished = await work(
      {
        quotationDate: "2026-11-23",
        vatPercent: "5",
        termPayment: "Cash",
        bankAccount: firstId,
      },
      true,
    );
    assert.equal(finished.currentStage, "lpo");

    // Accounts corrects the account, then stops using it altogether.
    await updateBankAccountForUser(
      people.tina.userId,
      ORG,
      firstId,
      account("First Bank", { accountNumber: "999", branch: "Deira" }),
    );
    const left = await removeBankAccountForUser(
      people.tina.userId,
      ORG,
      firstId,
    );
    assert.deepEqual(
      left.map((item) => item.bankName),
      ["Second Bank"],
    );

    const later = await getInquiryForUser(people.adam.userId, ORG, inquiryId);
    assert.equal(step(later!, "quotation").bank?.accountNumber, "1234567890");
    assert.equal(step(later!, "quotation").bank?.branch, "");
    assert.deepEqual(
      later!.bankAccounts.map((item) => item.id),
      [secondId],
    );
  });

  test("when the usual account goes, the oldest of the others takes over", async () => {
    await addBankAccountForUser(people.tina.userId, ORG, account("Third Bank"));
    const left = await removeBankAccountForUser(
      people.tina.userId,
      ORG,
      secondId,
    );
    assert.deepEqual(
      left.map((item) => [item.bankName, item.isDefault]),
      [["Third Bank", true]],
    );
    await refused(
      setDefaultBankAccountForUser(people.tina.userId, ORG, secondId),
      /no longer there/,
    );
  });
});

describe("the name a paper is printed under", () => {
  let inquiryId: string;
  let workshopId: string;
  const quotation = (fields: Record<string, string>, notes?: unknown) =>
    saveInquiryStageForUser(
      people.adam.userId,
      ORG,
      inquiryId,
      {
        fields: {
          quotationDate: "2026-11-25",
          vatPercent: "5",
          termPayment: "Cash",
          ...fields,
        },
        lineItems: [],
        tables: notes
          ? { notes: notes as Record<string, string>[] }
          : undefined,
      },
      { complete: false },
    );

  before(async () => {
    const created = await createInquiryForUser(people.adam.userId, ORG, {
      fields: { customerName: "Two Names LLC", title: "Canopy", contact: "1" },
      lineItems: [],
    });
    inquiryId = created.id;
    await assignInquiryForUser(owner, ORG, inquiryId, people.adam.staffId);
    await saveInquiryStageForUser(
      people.adam.userId,
      ORG,
      inquiryId,
      { fields: step(created, "inquiry").fields, lineItems: [] },
      { complete: true },
    );
    await assignInquiryForUser(owner, ORG, inquiryId, people.adam.staffId);
  });

  test("whoever sets the company up adds its other names", async () => {
    const name = {
      name: "Bank Works Workshop",
      nameArabic: "",
      logoImage: null,
    };
    await refused(
      saveLetterheadForUser(people.tina.userId, ORG, null, name),
      /permission/,
    );
    await refused(
      saveLetterheadForUser(owner, ORG, null, { ...name, name: "bank works" }),
      /already prints under/,
    );
    await refused(
      saveLetterheadForUser(owner, ORG, null, {
        ...name,
        logoImage: "data:text/html;base64,AAAA",
      }),
      /PNG or JPG/,
    );

    const names = await saveLetterheadForUser(owner, ORG, null, name);
    assert.deepEqual(
      names.map((item) => item.name),
      ["Bank Works Workshop"],
    );
    workshopId = names[0]!.id;
    await refused(
      saveLetterheadForUser(owner, ORG, null, name),
      /already prints under/,
    );

    // Everyone who prepares papers is offered it.
    const company = await getCompanyLetterheadForUser(people.adam.userId, ORG);
    assert.deepEqual(
      company!.others.map((item) => [item.name, item.active]),
      [["Bank Works Workshop", true]],
    );
  });

  test("a paper is printed under the company's own name or another of its names", async () => {
    const own = await quotation({});
    assert.equal(step(own, "quotation").fields.letterhead, "");

    const other = await quotation({ letterhead: workshopId });
    assert.equal(step(other, "quotation").fields.letterhead, workshopId);

    await refused(
      quotation({ letterhead: crypto.randomUUID() }),
      /no longer in use/,
    );
  });

  test("a name the company stops using stays on the papers that carry it", async () => {
    const extra = await saveLetterheadForUser(owner, ORG, null, {
      name: "Bank Works Trading",
      nameArabic: "",
      logoImage: null,
    });
    const tradingId = extra.find((item) => item.name.endsWith("Trading"))!.id;
    assert.deepEqual(
      (await removeLetterheadForUser(owner, ORG, workshopId)).map(
        (item) => item.name,
      ),
      ["Bank Works Trading"],
    );

    // The quotation that carries it is saved again without complaint.
    const kept = await quotation({ letterhead: workshopId, discount: "1" });
    assert.equal(step(kept, "quotation").fields.letterhead, workshopId);
    const company = await getCompanyLetterheadForUser(people.adam.userId, ORG);
    assert.deepEqual(
      company!.others.map((item) => [item.name, item.active]),
      [
        ["Bank Works Trading", true],
        ["Bank Works Workshop", false],
      ],
    );

    // Once the paper moves to another name, the old one cannot come back.
    await quotation({ letterhead: tradingId });
    await refused(quotation({ letterhead: workshopId }), /no longer in use/);
  });

  test("the quotation keeps the notes typed under its terms, heading by heading", async () => {
    const saved = await quotation({}, [
      {
        heading: "Police Permission",
        text: "By the client.\nNot in our scope.",
      },
      { heading: "", text: "" },
      { heading: "Transportation", text: "" },
    ]);
    assert.deepEqual(step(saved, "quotation").tables.notes, [
      {
        heading: "Police Permission",
        text: "By the client.\nNot in our scope.",
      },
      { heading: "Transportation", text: "" },
    ]);
  });
});

describe("employee IDs", () => {
  const idOf = async (staffId: string) =>
    (await getStaffForUser(owner, ORG, staffId))!.employeeCode;

  test("everyone gets the next number of the company", async () => {
    const staff = await listStaffForUser(owner, ORG);
    assert.deepEqual(staff.map((item) => item.employeeCode).sort(), [
      "EMP-0001",
      "EMP-0002",
      "EMP-0003",
    ]);
    // The company's first employee is whoever set it up.
    assert.equal(
      staff.find((item) => item.employeeCode === "EMP-0001")?.isAdmin,
      true,
    );
  });

  test("an ID that is typed is kept, in capitals and without spaces", async () => {
    const worker = await createStaffForUser(
      owner,
      ORG,
      profile("Welder", ["engineering"], " w 17 "),
    );
    assert.equal(worker.employeeCode, "W17");
  });

  test("no two people share an ID", async () => {
    await refused(
      createStaffForUser(owner, ORG, profile("Fitter", ["engineering"], "w17")),
      /already belongs to someone else/,
    );
    await refused(
      updateStaffProfileForUser(owner, ORG, people.adam.staffId, {
        ...profile("Adam", ["admin"], "W17"),
      }),
      /already belongs to someone else/,
    );
  });

  test("a number typed by hand is passed over when numbers are given", async () => {
    // The next number would be EMP-0004; someone is given it by hand first.
    await createStaffForUser(
      owner,
      ORG,
      profile("Painter", ["engineering"], "EMP-0004"),
    );
    const next = await createStaffForUser(
      owner,
      ORG,
      profile("Helper", ["engineering"]),
    );
    assert.equal(next.employeeCode, "EMP-0005");
  });

  test("an ID can be changed, but nobody is left without one", async () => {
    const before = await idOf(people.tina.staffId);
    const cleared = await updateStaffProfileForUser(
      owner,
      ORG,
      people.tina.staffId,
      profile("Tina", ["accounts"], ""),
    );
    assert.equal(cleared.employeeCode, before);

    const changed = await updateStaffProfileForUser(
      owner,
      ORG,
      people.tina.staffId,
      profile("Tina", ["accounts"], "acc-01"),
    );
    assert.equal(changed.employeeCode, "ACC-01");
  });
});
