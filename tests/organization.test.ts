/**
 * The organisation chart: owners at the top, Accounts under them, the other
 * departments under Accounts. The paperwork takes its people from it: every
 * owner signs the forms, a position that is removed is no longer asked for,
 * and an inquiry step is approved by the owners or by one position.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import {
  chartPositions,
  namePositions,
  PASSWORD,
  PIN,
  refused,
} from "./helpers";
import { getAdminDatabaseUrl } from "@/db/admin-env";
import { authenticateUser } from "@/lib/auth/authenticate";
import type { StaffRoleKey } from "@/lib/departments/catalog";
import {
  createApprovalFormForUser,
  getApprovalFormDocumentForUser,
  listFormsAwaitingMySignature,
  signApprovalFormForUser,
} from "@/lib/forms/queries";
import {
  approveInquiryStageForUser,
  assignInquiryForUser,
  createInquiryForUser,
  getInquiryForUser,
  getInquiryWorkflowMapForUser,
  listInquiryTasksForUser,
  requestInquiryApprovalForUser,
  saveInquiryStageForUser,
  saveInquiryWorkflowMapForUser,
} from "@/lib/inquiries/queries";
import { can } from "@/lib/access/access";
import {
  createOrganizationForUser,
  resolveOrganizationForUser,
} from "@/lib/org/queries";
import {
  addPositionForUser,
  getOrganizationChartForUser,
  getWorkflowChoicesForUser,
  moveOwnerForUser,
  removePositionForUser,
  setDepartmentInUseForUser,
  updatePositionForUser,
} from "@/lib/organization/queries";
import { setApprovalPinForUser } from "@/lib/signoffs/credentials";
import {
  createStaffForUser,
  createStaffLoginForUser,
  getStaffForUser,
  updateStaffProfileForUser,
} from "@/lib/staff/queries";

const run = Date.now().toString(36);
const ORG = `chart-${run}`;
const admin = postgres(getAdminDatabaseUrl(), { max: 1 });

let owner: string;
type Person = { userId: string; staffId: string };
const people = {} as Record<
  "adam" | "tina" | "abu" | "didar" | "omar" | "fahad" | "quinn" | "sam",
  Person
>;

async function addPerson(name: string, departmentKeys: StaffRoleKey[]) {
  const staff = await createStaffForUser(owner, ORG, {
    fullName: name,
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
  const username = `${name.toLowerCase()}.${run}`;
  await createStaffLoginForUser(owner, ORG, staff.id, {
    username,
    password: PASSWORD,
  });
  const login = await authenticateUser(username, PASSWORD);
  assert.ok(login);
  await setApprovalPinForUser(login.userId, { password: PASSWORD, pin: PIN });
  return { userId: login.userId, staffId: staff.id };
}

const positionCalled = async (title: string) => {
  const position = (await chartPositions(owner, ORG)).find(
    (item) => item.title === title,
  );
  assert.ok(position, `no position called ${title}`);
  return position;
};

/** A petty cash form: signed by its preparer, the Accountant, then the owners. */
const raisePettyCash = async () =>
  (
    await createApprovalFormForUser(people.tina.userId, ORG, "petty_cash", {
      staffId: "",
      fields: { projectName: "General", requestDate: "2026-09-01" },
      lines: [{ description: "Food", invoiceQty: "1", invoiceAmount: "7" }],
    })
  ).id;

const sign = (person: Person, formId: string) =>
  signApprovalFormForUser(person.userId, ORG, formId, {
    pin: PIN,
    decision: "approved",
    remarks: "",
  });

const boxes = async (formId: string) => {
  const form = await getApprovalFormDocumentForUser(owner, ORG, formId);
  assert.ok(form);
  return {
    status: form.status,
    labels: form.signoffs.steps.map((step) => step.label),
    signed: form.signoffs.steps.map((step) => step.signed?.name ?? null),
    waitingFor: form.signoffs.waitingFor,
  };
};

before(async () => {
  const [row] =
    await admin`select id from users where is_platform_admin limit 1`;
  assert.ok(row, "run `npm run db:seed` first");
  owner = row.id;
  await createOrganizationForUser(owner, { name: "Chart Works", code: ORG });

  people.adam = await addPerson("Adam", ["admin"]);
  people.tina = await addPerson("Tina", ["accounts"]);
  people.abu = await addPerson("Abu", ["management"]);
  people.didar = await addPerson("Didar", ["admin"]);
  people.omar = await addPerson("Omar", ["admin"]);
  people.fahad = await addPerson("Fahad", ["engineering"]);
  people.quinn = await addPerson("Quinn", ["engineering"]);
  people.sam = await addPerson("Sam", ["sales"]);
});

after(async () => {
  await admin.end();
  await (
    globalThis as { postgresClient?: { end: () => Promise<void> } }
  ).postgresClient?.end();
});

describe("the chart", () => {
  test("a new company starts with two owners, Accounts and the other departments", async () => {
    const chart = await getOrganizationChartForUser(people.sam.userId, ORG);
    assert.ok(chart, "everyone in the company may look");
    assert.equal(chart.canEdit, false);
    assert.deepEqual(
      chart.owners.map((item) => [item.title, item.staffName]),
      [
        ["CEO & Managing Partner", ""],
        ["Managing Director", ""],
      ],
    );
    assert.deepEqual(
      chart.departments.map((item) => item.key),
      ["accounts", "admin", "sales", "engineering", "reception", "workers"],
    );
    assert.deepEqual(
      chart.departments.map((item) => item.positions.map((p) => p.title)),
      [["Accountant"], ["Admin", "Purchaser"], [], [], [], ["Foreman"]],
    );
    // Each owner signs every form; the Foreman signs three of them.
    assert.equal(chart.owners[0]!.signs.length, 7);
    assert.deepEqual(chart.departments.at(-1)!.positions[0]!.signs, [
      "Leave Request",
      "Material Request Approval Form",
      "Verbal Work Approval Form",
    ]);
    assert.deepEqual(chart.unfilledRoles, []);
    assert.deepEqual(
      chart.departments[1]!.staff.toSorted(),
      // The company's creator is on its staff too, in Admin.
      ["Adam", "Didar", "Omar", "Owner"],
    );
  });

  test("only an administrator changes it, and titles are checked", async () => {
    const foreman = await positionCalled("Foreman");
    await refused(
      updatePositionForUser(people.abu.userId, ORG, foreman.id, {
        title: "Foreman",
        staffId: people.fahad.staffId,
      }),
      /permission/,
    );
    await refused(
      updatePositionForUser(owner, ORG, foreman.id, {
        title: " ",
        staffId: "",
      }),
      /Give the position a title/,
    );
    await refused(
      updatePositionForUser(owner, ORG, foreman.id, {
        title: "accountant",
        staffId: "",
      }),
      /already a position called/,
    );
    await refused(
      addPositionForUser(owner, ORG, {
        block: "admin",
        title: "Second Purchaser",
        signsAs: "purchaser",
        staffId: "",
      }),
      /already on the chart/,
    );
  });

  test("an owner is put in Management; a position holder needs a login", async () => {
    assert.deepEqual(
      (await getStaffForUser(owner, ORG, people.didar.staffId))?.departmentKeys,
      ["admin"],
    );
    await namePositions(owner, ORG, {
      "CEO & Managing Partner": people.abu,
      "Managing Director": people.didar,
      Accountant: people.tina,
      Admin: people.adam,
      Purchaser: people.adam,
      Foreman: people.fahad,
    });
    assert.deepEqual(
      (
        await getStaffForUser(owner, ORG, people.didar.staffId)
      )?.departmentKeys.toSorted(),
      ["admin", "management"],
    );
  });
});

describe("owners and the forms", () => {
  let waitingOnSecondOwner: string;
  let finished: string;

  test("every owner signs, in the order they stand on the chart", async () => {
    finished = await raisePettyCash();
    assert.deepEqual((await boxes(finished)).labels, [
      "Prepared By",
      "Verified by Accounts",
      "Approved by CEO & Managing Partner",
      "Approved by Managing Director",
    ]);
    await sign(people.tina, finished);
    await sign(people.abu, finished);
    assert.equal(await sign(people.didar, finished), "approved");
  });

  test("a third owner gets a box on forms still going round, not on finished ones", async () => {
    waitingOnSecondOwner = await raisePettyCash();
    await sign(people.tina, waitingOnSecondOwner);
    await sign(people.abu, waitingOnSecondOwner);

    await addPositionForUser(owner, ORG, {
      block: "owners",
      title: "Technical Partner",
      signsAs: "",
      staffId: people.omar.staffId,
    });
    assert.deepEqual((await boxes(waitingOnSecondOwner)).labels, [
      "Prepared By",
      "Verified by Accounts",
      "Approved by CEO & Managing Partner",
      "Approved by Managing Director",
      "Approved by Technical Partner",
    ]);
    // The one already approved keeps the signatures it was approved with.
    const done = await boxes(finished);
    assert.equal(done.status, "approved");
    assert.deepEqual(done.signed, ["Tina", "Tina", "Abu", "Didar"]);
  });

  test("the owners' order is the order they sign in", async () => {
    const third = await positionCalled("Technical Partner");
    await moveOwnerForUser(owner, ORG, third.id, "earlier");
    assert.deepEqual(
      (await getOrganizationChartForUser(owner, ORG))!.owners.map(
        (item) => item.title,
      ),
      ["CEO & Managing Partner", "Technical Partner", "Managing Director"],
    );
    assert.equal(
      (await boxes(waitingOnSecondOwner)).waitingFor,
      "Approved by Technical Partner",
    );
    await refused(
      moveOwnerForUser(owner, ORG, third.id, "later").then(() =>
        moveOwnerForUser(owner, ORG, third.id, "later"),
      ),
      /cannot be moved/,
    );
  });

  test("removing an owner stops the forms asking for them", async () => {
    // Waiting for the Managing Director first, then the Technical Partner.
    assert.equal(
      (await boxes(waitingOnSecondOwner)).waitingFor,
      "Approved by Managing Director",
    );
    const third = await positionCalled("Technical Partner");
    const afterThird = await removePositionForUser(owner, ORG, third.id);
    assert.equal(afterThird.settled, 0);

    // The form was only waiting for the Managing Director: removing that
    // position approves it.
    const second = await positionCalled("Managing Director");
    const afterSecond = await removePositionForUser(owner, ORG, second.id);
    assert.equal(afterSecond.settled, 1);
    const form = await boxes(waitingOnSecondOwner);
    assert.equal(form.status, "approved");
    assert.deepEqual(form.signed, ["Tina", "Tina", "Abu"]);
    assert.deepEqual(
      await listFormsAwaitingMySignature(people.didar.userId, ORG),
      [],
    );

    // New forms have one owner's box.
    assert.deepEqual((await boxes(await raisePettyCash())).labels, [
      "Prepared By",
      "Verified by Accounts",
      "Approved by CEO & Managing Partner",
    ]);
  });

  test("a company has between one and four owners", async () => {
    const last = await positionCalled("CEO & Managing Partner");
    await refused(
      removePositionForUser(owner, ORG, last.id),
      /at least one owner/,
    );
    for (const title of ["Partner 2", "Partner 3", "Partner 4"]) {
      await addPositionForUser(owner, ORG, {
        block: "owners",
        title,
        signsAs: "",
        staffId: "",
      });
    }
    await refused(
      addPositionForUser(owner, ORG, {
        block: "owners",
        title: "Partner 5",
        signsAs: "",
        staffId: "",
      }),
      /up to 4 owners/,
    );
    // An owner nobody has been named for holds the forms up.
    await refused(
      raisePettyCash(),
      /Nobody is set as Partner 2, Partner 3, Partner 4/,
    );
    for (const title of ["Partner 2", "Partner 3", "Partner 4"]) {
      await removePositionForUser(owner, ORG, (await positionCalled(title)).id);
    }
  });
});

describe("positions and the forms", () => {
  const materialRequest = () =>
    createApprovalFormForUser(people.fahad.userId, ORG, "material_request", {
      staffId: "",
      fields: { projectName: "Staircase", requestDate: "2026-09-01" },
      lines: [{ materialDescription: "MS plate", qty: "2" }],
    });

  test("a position taken off the chart has no box; put back, it has one again", async () => {
    const before = await materialRequest();
    assert.deepEqual((await boxes(before.id)).labels, [
      "Verified by Forman",
      "Verified by Purchaser",
      "Verified by Accounts",
      "Approved by CEO & Managing Partner",
    ]);

    await removePositionForUser(
      owner,
      ORG,
      (await positionCalled("Purchaser")).id,
    );
    const chart = await getOrganizationChartForUser(owner, ORG);
    assert.deepEqual(
      chart!.unfilledRoles.map((role) => [role.key, role.signs]),
      [
        [
          "purchaser",
          ["Material Request Approval Form", "Verbal Work Approval Form"],
        ],
      ],
    );
    assert.deepEqual((await boxes(before.id)).labels, [
      "Verified by Forman",
      "Verified by Accounts",
      "Approved by CEO & Managing Partner",
    ]);

    await addPositionForUser(owner, ORG, {
      block: "accounts",
      title: "Buyer",
      signsAs: "purchaser",
      staffId: people.tina.staffId,
    });
    assert.deepEqual((await boxes(before.id)).labels, [
      "Verified by Forman",
      "Verified by Purchaser",
      "Verified by Accounts",
      "Approved by CEO & Managing Partner",
    ]);
    assert.deepEqual(
      (await getOrganizationChartForUser(owner, ORG))!.unfilledRoles,
      [],
    );
  });

  test("someone who signed can still open the form after leaving the chart", async () => {
    const form = await materialRequest();
    await signApprovalFormForUser(people.fahad.userId, ORG, form.id, {
      pin: PIN,
      decision: "approved",
      remarks: "",
    });
    const foreman = await positionCalled("Foreman");
    await updatePositionForUser(owner, ORG, foreman.id, {
      title: "Foreman",
      staffId: people.quinn.staffId,
    });
    assert.ok(
      await getApprovalFormDocumentForUser(people.fahad.userId, ORG, form.id),
    );
    // His signature stays as it was given.
    assert.equal((await boxes(form.id)).signed[0], "Fahad");
  });
});

describe("who approves an inquiry step", () => {
  let inspector: string;
  let inquiryId: string;

  const setApprover = async (stage: "inquiry" | "quotation", by: string) => {
    const map = (await getInquiryWorkflowMapForUser(owner, ORG))!;
    map[stage] = {
      departmentKey: "admin",
      approvalRequired: by !== "",
      approvalRequiredBy: by,
    };
    return saveInquiryWorkflowMapForUser(owner, ORG, map);
  };

  test("the choices are the owners and every position on the chart", async () => {
    inspector = (
      await addPositionForUser(owner, ORG, {
        block: "engineering",
        title: "QC Inspector",
        signsAs: "",
        staffId: people.quinn.staffId,
      })
    ).chart.departments
      .find((item) => item.key === "engineering")!
      .positions.find((item) => item.title === "QC Inspector")!.id;

    const choices = await getWorkflowChoicesForUser(owner, ORG);
    assert.deepEqual(
      choices!.approvers.map((item) => item.label),
      [
        "Owners (any one of them)",
        "Accountant (Tina)",
        "Buyer (Tina)",
        "Admin (Adam)",
        "QC Inspector (Quinn)",
        "Foreman (Quinn)",
      ],
    );
    await refused(
      setApprover("inquiry", "management"),
      /Select who must approve/,
    );
  });

  test("a step set to a position is approved by whoever holds it", async () => {
    await setApprover("inquiry", inspector);
    const created = await createInquiryForUser(people.adam.userId, ORG, {
      fields: { customerName: "Gulf Marine", title: "Handrail", contact: "1" },
      lineItems: [],
    });
    inquiryId = created.id;
    await assignInquiryForUser(owner, ORG, inquiryId, people.adam.staffId);
    const sent = await requestInquiryApprovalForUser(
      people.adam.userId,
      ORG,
      inquiryId,
      { fields: created.steps[0]!.fields, lineItems: [] },
    );
    assert.equal(sent.steps[0]!.approvalBy, "QC Inspector");

    // Quinn is in Engineering, not Admin, and still sees what she approves.
    assert.deepEqual(
      (await listInquiryTasksForUser(people.quinn.userId, ORG)).map(
        (task) => task.reason,
      ),
      ["approval"],
    );
    await refused(
      approveInquiryStageForUser(people.abu.userId, ORG, inquiryId),
      /Only QC Inspector/,
    );
    const approved = await approveInquiryStageForUser(
      people.quinn.userId,
      ORG,
      inquiryId,
    );
    assert.equal(approved.currentStageApproved, true);
  });

  test("taking the position off the chart takes the approval off the step", async () => {
    const second = await createInquiryForUser(people.adam.userId, ORG, {
      fields: { customerName: "Delta", title: "Gate", contact: "2" },
      lineItems: [],
    });
    await assignInquiryForUser(owner, ORG, second.id, people.adam.staffId);
    const save = () =>
      saveInquiryStageForUser(
        people.adam.userId,
        ORG,
        second.id,
        { fields: second.steps[0]!.fields, lineItems: [] },
        { complete: true },
      );
    await refused(save(), /Approval required by QC Inspector/);

    await removePositionForUser(owner, ORG, inspector);
    const map = await getInquiryWorkflowMapForUser(owner, ORG);
    assert.equal(map!.inquiry.approvalRequired, false);
    assert.equal((await save()).currentStage, "quotation");
  });

  test("a step set to the owners is approved by any one of them", async () => {
    await addPositionForUser(owner, ORG, {
      block: "owners",
      title: "Managing Director",
      signsAs: "",
      staffId: people.didar.staffId,
    });
    await setApprover("quotation", "owners");
    const moved = await saveInquiryStageForUser(
      people.adam.userId,
      ORG,
      inquiryId,
      {
        fields: (await getInquiryForUser(owner, ORG, inquiryId))!.steps[0]!
          .fields,
        lineItems: [
          {
            description: "Handrail",
            quantity: "1",
            unit: "Set",
            unitPrice: "100",
            deliveredQuantity: "",
            details: {},
          },
        ],
      },
      { complete: true },
    );
    assert.equal(moved.currentStage, "quotation");
    assert.equal(moved.steps[1]!.approvalBy, "Owners");

    await assignInquiryForUser(owner, ORG, inquiryId, people.adam.staffId);
    await requestInquiryApprovalForUser(people.adam.userId, ORG, inquiryId, {
      fields: {
        quotationDate: "2026-09-01",
        vatPercent: "5",
        termPayment: "Cash",
      },
      lineItems: moved.lineItems,
    });
    for (const person of [people.abu, people.didar]) {
      assert.equal(
        (await listInquiryTasksForUser(person.userId, ORG)).length,
        1,
      );
    }
    await refused(
      approveInquiryStageForUser(people.tina.userId, ORG, inquiryId),
      /Inquiry not found|Only Owners/,
    );
    const approved = await approveInquiryStageForUser(
      people.didar.userId,
      ORG,
      inquiryId,
    );
    assert.equal(approved.currentStageApproved, true);
  });
});

describe("departments the company has", () => {
  test("a department goes once nobody is in it and no step is prepared by it", async () => {
    await refused(
      setDepartmentInUseForUser(owner, ORG, "accounts", false),
      /Every company has Accounts/,
    );
    await refused(
      setDepartmentInUseForUser(owner, ORG, "sales", false),
      /1 person is still in Sales/,
    );
    await refused(
      setDepartmentInUseForUser(owner, ORG, "admin", false),
      /people are still in Admin/,
    );

    // Sam moves to Reception; Sales has nobody and prepares nothing.
    const sam = (await getStaffForUser(owner, ORG, people.sam.staffId))!;
    await updateStaffProfileForUser(owner, ORG, people.sam.staffId, {
      ...sam,
      departmentKeys: ["reception"],
    });
    const { chart } = await setDepartmentInUseForUser(
      owner,
      ORG,
      "sales",
      false,
    );
    assert.deepEqual(chart.closedDepartments, [
      { key: "sales", label: "Sales" },
    ]);
    assert.ok(!chart.departments.some((item) => item.key === "sales"));
  });

  test("a department the company does not have cannot be opened or given work", async () => {
    const org = await resolveOrganizationForUser(owner, ORG);
    assert.equal(can.openDepartment(org!.access, "sales"), false);
    assert.equal(can.openDepartment(org!.access, "admin"), true);

    const choices = await getWorkflowChoicesForUser(owner, ORG);
    assert.ok(!choices!.departments.some((item) => item.key === "sales"));
    const map = (await getInquiryWorkflowMapForUser(owner, ORG))!;
    map.delivery_note.departmentKey = "sales";
    await refused(
      saveInquiryWorkflowMapForUser(owner, ORG, map),
      /Choose a department for Delivery Note/,
    );
    await refused(
      addPositionForUser(owner, ORG, {
        block: "sales",
        title: "Sales Head",
        signsAs: "",
        staffId: "",
      }),
      /department the company has/,
    );
    const sam = (await getStaffForUser(owner, ORG, people.sam.staffId))!;
    await refused(
      updateStaffProfileForUser(owner, ORG, people.sam.staffId, {
        ...sam,
        departmentKeys: ["sales"],
      }),
      /does not have a Sales department/,
    );
  });

  test("it can be added back", async () => {
    const { chart } = await setDepartmentInUseForUser(
      owner,
      ORG,
      "sales",
      true,
    );
    assert.deepEqual(chart.closedDepartments, []);
    const org = await resolveOrganizationForUser(owner, ORG);
    assert.equal(can.openDepartment(org!.access, "sales"), true);
  });

  test("a department that prepares a step stays", async () => {
    const map = (await getInquiryWorkflowMapForUser(owner, ORG))!;
    map.delivery_note.departmentKey = "sales";
    await saveInquiryWorkflowMapForUser(owner, ORG, map);
    await refused(
      setDepartmentInUseForUser(owner, ORG, "sales", false),
      /Sales still prepares Delivery Note/,
    );
  });
});

describe("a person who holds a position", () => {
  test("stays active until someone else is put in the position", async () => {
    const held = (await chartPositions(owner, ORG)).filter(
      (position) => position.staffId === people.tina.staffId,
    );
    assert.ok(held.length > 0, "Tina holds a position");
    const tina = (await getStaffForUser(owner, ORG, people.tina.staffId))!;
    await refused(
      updateStaffProfileForUser(owner, ORG, people.tina.staffId, {
        ...tina,
        status: "inactive",
      }),
      /Tina holds Accountant.* on the Organization chart/,
    );

    for (const position of held) {
      await updatePositionForUser(owner, ORG, position.id, {
        title: position.title,
        staffId: "",
      });
    }
    const left = await updateStaffProfileForUser(
      owner,
      ORG,
      people.tina.staffId,
      { ...tina, status: "inactive" },
    );
    assert.equal(left.status, "inactive");
  });
});
