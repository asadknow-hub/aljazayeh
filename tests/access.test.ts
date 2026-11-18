/**
 * End-to-end tests of the rules that matter most: who can do what inside a
 * company, that companies cannot see each other, and that the inquiry
 * pipeline enforces assignment and approval.
 *
 * They run the real server code against a real database
 * (`npm run db:setup` first). Each run creates its own companies.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import { leaveInput, makeSoleSignatory } from "./helpers";
import { getAdminDatabaseUrl, getAppDatabaseUrl } from "@/db/admin-env";
import { authenticateUser } from "@/lib/auth/authenticate";
import { saveCompanySettingsForUser } from "@/lib/company-settings/queries";
import { UserError } from "@/lib/errors";
import {
  approveInquiryStageForUser,
  assignInquiryForUser,
  getInquiryForUser,
  getInquiryWorkflowMapForUser,
  listInquiriesForDepartment,
  listInquiriesForUser,
  moveInquiryStageForUser,
  saveInquiryWorkflowMapForUser,
  updateInquiryForUser,
} from "@/lib/inquiries/queries";
import {
  createOrganizationForUser,
  listUserOrganizations,
} from "@/lib/org/queries";
import {
  createStaffForUser,
  createStaffLoginForUser,
  deleteStaffForUser,
  listStaffForUser,
  resetStaffPasswordForUser,
  setStaffAdminForUser,
  updateStaffProfileForUser,
  updateStaffSalaryForUser,
} from "@/lib/staff/queries";
import type { StaffRoleKey } from "@/lib/departments/catalog";
import { createVacationRequestForUser } from "@/lib/vacation/queries";
import {
  createVisitorLogForUser,
  listVisitorLogsForUser,
} from "@/lib/visitors/queries";

const run = Date.now().toString(36);
const ORG = `test-${run}`;
const OTHER_ORG = `other-${run}`;
const PASSWORD = "correct-horse-battery";

const admin = postgres(getAdminDatabaseUrl(), { max: 1 });
const appRole = postgres(getAppDatabaseUrl(), { max: 1 });

let owner: string;
type Person = { userId: string; staffId: string; username: string };
const people = {} as Record<"sara" | "ravi" | "mona", Person>;

async function addPerson(
  name: string,
  departments: StaffRoleKey[],
): Promise<Person> {
  const username = `${name}.${run}`;
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
    departmentKeys: departments,
  });
  await createStaffLoginForUser(owner, ORG, staff.id, {
    username,
    password: PASSWORD,
  });
  const login = await authenticateUser(username, PASSWORD);
  assert.ok(login, "a new login can sign in");
  return { userId: login.userId, staffId: staff.id, username };
}

const denied = (work: Promise<unknown>) =>
  assert.rejects(work, (error: unknown) => {
    assert.ok(error instanceof UserError, `expected UserError, got ${error}`);
    assert.match(error.message, /permission/);
    return true;
  });

const refused = (work: Promise<unknown>, message: RegExp) =>
  assert.rejects(work, (error: unknown) => {
    assert.ok(error instanceof UserError, `expected UserError, got ${error}`);
    assert.match(error.message, message);
    return true;
  });

/** Run SQL the way the app's database role would for a given user. */
async function asUser<T>(
  userId: string,
  work: (sql: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return appRole.begin(async (sql) => {
    await sql`select set_config('app.user_id', ${userId}, true)`;
    return work(sql);
  }) as Promise<T>;
}

before(async () => {
  const [row] =
    await admin`select id from users where is_platform_admin limit 1`;
  assert.ok(row, "run `npm run db:seed` first");
  owner = row.id;

  await createOrganizationForUser(owner, { name: "Test Works", code: ORG });
  people.sara = await addPerson("Sara", ["sales"]);
  people.ravi = await addPerson("Ravi", ["reception"]);
  people.mona = await addPerson("Mona", ["management"]);
});

after(async () => {
  await admin.end();
  await appRole.end();
  await (
    globalThis as { postgresClient?: { end: () => Promise<void> } }
  ).postgresClient?.end();
});

describe("companies", () => {
  test("the creator becomes the company's administrator", async () => {
    const mine = await listUserOrganizations(owner);
    assert.ok(mine.some((org) => org.code === ORG));
    const staff = await listStaffForUser(owner, ORG);
    const me = staff.find((item) => item.isAdmin);
    assert.ok(me);
    assert.deepEqual(me.departmentKeys.toSorted(), ["admin", "management"]);
  });

  test("only the owner's login can create companies", async () => {
    await refused(
      createOrganizationForUser(people.mona.userId, {
        name: "Mona Co",
        code: `mona-${run}`,
      }),
      /permission/,
    );
  });

  test("one company's people cannot see another company", async () => {
    await createOrganizationForUser(owner, { name: "Other", code: OTHER_ORG });
    for (const person of Object.values(people)) {
      assert.deepEqual(
        await listInquiriesForUser(person.userId, OTHER_ORG),
        [],
      );
      assert.deepEqual(await listStaffForUser(person.userId, OTHER_ORG), []);
      assert.equal(
        (await listUserOrganizations(person.userId)).some(
          (org) => org.code === OTHER_ORG,
        ),
        false,
      );
    }
    // Even with direct database access as the app role.
    const visible = await asUser(
      people.mona.userId,
      (sql) => sql`select code from organizations`,
    );
    assert.deepEqual(
      visible.map((row) => row.code),
      [ORG],
    );
  });

  test("without a signed-in user the database shows nothing", async () => {
    const [row] = await appRole`select count(*)::int as n from organizations`;
    assert.equal(row.n, 0);
  });
});

describe("who can do what", () => {
  const settings = {
    companyName: "Renamed",
    telephoneNumber: "",
    phoneNumber: "",
    whatsappNumber: "",
    email: "",
    websiteUrl: "",
    instagramUrl: "",
    facebookUrl: "",
    adminName: "",
    adminEmail: "",
    nameArabic: "",
    attendanceSheetNotes: "",
  };
  const salary = {
    salaryAmount: "1",
    salaryCurrency: "AED",
    payFrequency: "monthly",
    lastSalaryPaidOn: "",
    salaryNotes: "",
  };

  test("ordinary staff cannot touch settings, staff records or logins", async () => {
    const { userId } = people.sara;
    assert.deepEqual(await listStaffForUser(userId, ORG), []);
    assert.equal(await getInquiryWorkflowMapForUser(userId, ORG), null);
    await denied(saveCompanySettingsForUser(userId, ORG, settings));
    await denied(
      updateStaffSalaryForUser(userId, ORG, people.ravi.staffId, salary),
    );
    await denied(setStaffAdminForUser(userId, ORG, people.sara.staffId, true));
    await denied(
      resetStaffPasswordForUser(userId, ORG, people.ravi.staffId, PASSWORD),
    );
    const map = await getInquiryWorkflowMapForUser(owner, ORG);
    assert.ok(map);
    await denied(saveInquiryWorkflowMapForUser(userId, ORG, map));
  });

  test("the database itself refuses privilege escalation", async () => {
    const { userId, staffId } = people.sara;
    const changed = await asUser(userId, async (sql) => [
      await sql`update staff_members set is_admin = true where id = ${staffId} returning id`,
      await sql`update organizations set name = 'Hacked' returning id`,
      await sql`update inquiry_workflow_settings set approval_required = false returning id`,
      await sql`delete from staff_activity_logs returning id`,
    ]);
    assert.deepEqual(
      changed.map((rows) => rows.length),
      [0, 0, 0, 0],
    );
  });

  test("management oversees staff and leave but not company settings", async () => {
    const { userId } = people.mona;
    assert.ok((await listStaffForUser(userId, ORG)).length >= 4);
    await updateStaffSalaryForUser(userId, ORG, people.ravi.staffId, salary);
    await denied(saveCompanySettingsForUser(userId, ORG, settings));
    await denied(setStaffAdminForUser(userId, ORG, people.mona.staffId, true));
  });

  test("reception logs visitors and raises leave; other staff cannot", async () => {
    await makeSoleSignatory(owner, ORG, people.mona);
    const leave = await createVacationRequestForUser(
      people.ravi.userId,
      ORG,
      leaveInput(people.sara.staffId, "2030-01-07", "2030-01-08"),
    );
    assert.equal(leave.dayCount, 2);
    assert.equal(leave.returnDate, "2030-01-09");

    await denied(
      createVacationRequestForUser(
        people.sara.userId,
        ORG,
        leaveInput(people.sara.staffId, "2030-02-01", "2030-02-01"),
      ),
    );
    assert.deepEqual(await listVisitorLogsForUser(people.sara.userId, ORG), []);
  });
});

describe("logins", () => {
  test("usernames are unique and passwords have a minimum length", async () => {
    const staff = await createStaffForUser(owner, ORG, {
      fullName: "Temp",
      email: "",
      phone: "",
      homeCountryContact: "",
      passportNumber: "",
      jobTitle: "",
      employeeCode: "",
      joinedOn: "",
      status: "active",
      notes: "",
      departmentKeys: ["workers"],
    });
    await refused(
      createStaffLoginForUser(owner, ORG, staff.id, {
        username: people.sara.username,
        password: PASSWORD,
      }),
      /already in use/,
    );
    await refused(
      createStaffLoginForUser(owner, ORG, staff.id, {
        username: `temp.${run}`,
        password: "short",
      }),
      /at least 8/,
    );
    // Never used and no login: a mistaken record can be removed.
    await deleteStaffForUser(owner, ORG, staff.id);
  });

  test("an administrator resets a password; the old one stops working", async () => {
    await resetStaffPasswordForUser(
      owner,
      ORG,
      people.ravi.staffId,
      "a-new-password",
    );
    assert.equal(await authenticateUser(people.ravi.username, PASSWORD), null);
    assert.ok(await authenticateUser(people.ravi.username, "a-new-password"));
  });

  test("another administrator cannot take over the owner's login", async () => {
    await setStaffAdminForUser(owner, ORG, people.mona.staffId, true);
    const ownerStaff = (await listStaffForUser(owner, ORG)).find(
      (item) =>
        item.loginUsername && item.isAdmin && item.id !== people.mona.staffId,
    );
    assert.ok(ownerStaff);
    await refused(
      resetStaffPasswordForUser(
        people.mona.userId,
        ORG,
        ownerStaff.id,
        PASSWORD,
      ),
      /Only the owner/,
    );
    await setStaffAdminForUser(owner, ORG, people.mona.staffId, false);
  });

  test("people with history are deactivated, not deleted", async () => {
    await refused(
      deleteStaffForUser(owner, ORG, people.sara.staffId),
      /Inactive instead/,
    );
  });
});

describe("inquiry pipeline", () => {
  let inquiryId: string;

  before(async () => {
    // Sales handles new inquiries and Management must approve them;
    // quotations go to Accounts.
    const map = await getInquiryWorkflowMapForUser(owner, ORG);
    assert.ok(map);
    map.inquiry = {
      departmentKey: "sales",
      approvalRequired: true,
      approvalRequiredBy: "management",
    };
    map.quotation = {
      departmentKey: "accounts",
      approvalRequired: false,
      approvalRequiredBy: "",
    };
    await saveInquiryWorkflowMapForUser(owner, ORG, map);
  });

  test("a visitor logged at reception starts an inquiry for the right department", async () => {
    const visitor = await createVisitorLogForUser(people.ravi.userId, ORG, {
      fullName: "Walk-in Customer",
      visitDate: "2030-01-05",
      visitTime: "10:30",
      purpose: "inquiry",
      notes: "Stainless handrail, 12 m",
    });
    // 10:30 in Dubai, whatever timezone the server runs in.
    assert.equal(visitor.visitedAt, "2030-01-05T06:30:00.000Z");
    assert.ok(visitor.inquiryId);
    inquiryId = visitor.inquiryId;

    const queue = await listInquiriesForDepartment(
      people.sara.userId,
      ORG,
      "sales",
    );
    assert.deepEqual(
      queue.map((item) => item.id),
      [inquiryId],
    );
    // Reception hands over; it does not see the pipeline.
    assert.equal(
      await getInquiryForUser(people.ravi.userId, ORG, inquiryId),
      null,
    );
    assert.deepEqual(await listInquiriesForUser(people.sara.userId, ORG), []);
  });

  test("nothing happens until someone in the department is assigned", async () => {
    await refused(
      moveInquiryStageForUser(people.sara.userId, ORG, inquiryId, "next"),
      /Assign a person/,
    );
    await refused(
      assignInquiryForUser(
        people.mona.userId,
        ORG,
        inquiryId,
        people.ravi.staffId,
      ),
      /from this department/,
    );
    const assigned = await assignInquiryForUser(
      people.mona.userId,
      ORG,
      inquiryId,
      people.sara.staffId,
    );
    assert.equal(assigned.assignedStaffName, "Sara");
  });

  test("a stage that needs approval cannot be passed without it", async () => {
    await refused(
      moveInquiryStageForUser(people.sara.userId, ORG, inquiryId, "next"),
      /Approval required by Management/,
    );
    await refused(
      approveInquiryStageForUser(people.sara.userId, ORG, inquiryId),
      /Only Management/,
    );
    const approved = await approveInquiryStageForUser(
      people.mona.userId,
      ORG,
      inquiryId,
    );
    assert.equal(approved.currentStageApproved, true);
  });

  test("changing an inquiry after approval voids the approval", async () => {
    const edited = await updateInquiryForUser(
      people.sara.userId,
      ORG,
      inquiryId,
      {
        customerName: "Walk-in Customer",
        contact: "",
        deliveryExpectedOn: "",
        notes: "",
        lineItems: [
          { description: "Handrail", quantity: "12", unitPrice: "950" },
        ],
      },
    );
    assert.equal(edited.currentStageApproved, false);
    await refused(
      moveInquiryStageForUser(people.sara.userId, ORG, inquiryId, "next"),
      /Approval required/,
    );
    await approveInquiryStageForUser(people.mona.userId, ORG, inquiryId);
  });

  test("moving on hands the inquiry to the next department", async () => {
    const moved = await moveInquiryStageForUser(
      people.sara.userId,
      ORG,
      inquiryId,
      "next",
    );
    assert.equal(moved.currentStage, "quotation");
    assert.equal(moved.owningDepartmentKey, "accounts");
    assert.equal(
      moved.assignedStaffId,
      null,
      "the new department assigns its own person",
    );

    // Sales no longer has it. Management still sees it, but only the
    // department that owns an inquiry works on it.
    assert.equal(
      await getInquiryForUser(people.sara.userId, ORG, inquiryId),
      null,
    );
    assert.ok(await getInquiryForUser(people.mona.userId, ORG, inquiryId));
    await denied(
      updateInquiryForUser(people.mona.userId, ORG, inquiryId, {
        customerName: "Changed",
        contact: "",
        deliveryExpectedOn: "",
        notes: "",
        lineItems: [],
      }),
    );
  });

  test("moving back reopens the earlier stage for approval", async () => {
    const accountant = await addPerson("Aziz", ["accounts"]);
    await assignInquiryForUser(owner, ORG, inquiryId, accountant.staffId);
    const back = await moveInquiryStageForUser(
      accountant.userId,
      ORG,
      inquiryId,
      "previous",
    );
    assert.equal(back.currentStage, "inquiry");
    const view = await getInquiryForUser(owner, ORG, inquiryId);
    assert.ok(view);
    assert.equal(view.currentStageApproved, false);
    assert.ok(
      view.activityLogs.some((log) => /Approval cleared/.test(log.label)),
    );
  });

  test("an inactive person loses access immediately", async () => {
    const staff = (await listStaffForUser(owner, ORG)).find(
      (item) => item.id === people.sara.staffId,
    );
    assert.ok(staff);
    await updateStaffProfileForUser(owner, ORG, staff.id, {
      fullName: staff.fullName,
      email: staff.email,
      phone: staff.phone,
      homeCountryContact: staff.homeCountryContact,
      passportNumber: staff.passportNumber,
      jobTitle: staff.jobTitle,
      employeeCode: staff.employeeCode,
      joinedOn: staff.joinedOn,
      notes: staff.notes,
      departmentKeys: staff.departmentKeys,
      status: "inactive",
    });

    assert.deepEqual(await listUserOrganizations(people.sara.userId), []);
    assert.deepEqual(
      await listInquiriesForDepartment(people.sara.userId, ORG, "sales"),
      [],
    );
    const [row] = await asUser(
      people.sara.userId,
      (sql) => sql`select count(*)::int as n from inquiries`,
    );
    assert.equal(row.n, 0);
  });
});

describe("malformed links", () => {
  test("an id that is not an id is simply not found", async () => {
    const { getStaffForUser } = await import("@/lib/staff/queries");
    const { getLeaveDocumentForUser } = await import("@/lib/vacation/queries");
    const { getApprovalFormDocumentForUser } =
      await import("@/lib/forms/queries");
    assert.equal(await getStaffForUser(owner, ORG, "abc"), null);
    assert.equal(await getInquiryForUser(owner, ORG, "abc"), null);
    assert.equal(await getLeaveDocumentForUser(owner, ORG, "abc"), null);
    assert.equal(await getApprovalFormDocumentForUser(owner, ORG, "abc"), null);
  });
});
