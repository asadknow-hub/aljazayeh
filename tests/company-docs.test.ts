/**
 * Company Docs: a company changes the wording of a paper, which details it
 * asks for and the code in its numbers. New papers follow the change, and
 * papers of steps already finished stay as they were issued.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import { PASSWORD, refused } from "./helpers";
import { getAdminDatabaseUrl } from "@/db/admin-env";
import { authenticateUser } from "@/lib/auth/authenticate";
import { INQUIRY_CATALOG, SIGNED_FORM_KEYS } from "@/lib/company-docs/catalog";
import {
  getCompanyDocForUser,
  getCompanyDocsForUser,
  restoreCompanyDocVersionForUser,
  saveCompanyDocForUser,
} from "@/lib/company-docs/queries";
import type { DocumentSettingsInput } from "@/lib/company-docs/validate";
import { appDateValue } from "@/lib/datetime/format";
import type { StaffRoleKey } from "@/lib/departments/catalog";
import { FORM_DEFINITIONS, FORM_TYPES } from "@/lib/forms/definitions";
import {
  assignInquiryForUser,
  createInquiryForUser,
  getInquiryForUser,
  saveInquiryStageForUser,
  sendInquiryBackForUser,
} from "@/lib/inquiries/queries";
import { INQUIRY_STAGES } from "@/lib/inquiries/stages";
import {
  canSetPrefill,
  paperText,
  STAGE_DEFINITIONS,
  stageFields,
} from "@/lib/inquiries/stage-forms";
import type { InquiryView } from "@/lib/inquiries/types";
import { createOrganizationForUser } from "@/lib/org/queries";
import {
  createStaffForUser,
  createStaffLoginForUser,
} from "@/lib/staff/queries";

const run = Date.now().toString(36);
const ORG = `docs-${run}`;
const PREFIX = ORG.toUpperCase();
const YEAR = appDateValue().slice(0, 4);
const admin = postgres(getAdminDatabaseUrl(), { max: 1 });

let owner: string;
type Person = { userId: string; staffId: string };
const people = {} as Record<"adam" | "mona", Person>;

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

/** What the Company Docs screen sends for a paper nobody has changed. */
async function untouched(
  stage: string,
  document: string,
): Promise<DocumentSettingsInput> {
  const entry = INQUIRY_CATALOG.find(
    (item) => item.stage === stage && item.document === document,
  );
  assert.ok(entry);
  return {
    code: entry.counterKey ?? "",
    texts: Object.fromEntries(
      entry.texts.map((text) => [text.key, text.value]),
    ),
    fields: Object.fromEntries(
      entry.fields.map((field) => [
        field.key,
        {
          asked: true,
          required: Boolean(field.required),
          prefill: canSetPrefill(field) ? (field.prefill ?? "") : "",
        },
      ]),
    ),
  };
}

/** A new job taken as far as the Quotation step, assigned to Adam. */
async function jobAtQuotation(customer: string): Promise<InquiryView> {
  const created = await createInquiryForUser(people.adam.userId, ORG, {
    fields: {
      customerName: customer,
      title: "Handrail",
      contact: "04 555 0100",
    },
    lineItems: [
      {
        description: "SS handrail",
        quantity: "12",
        unit: "m",
        unitPrice: "150",
        deliveredQuantity: "",
        details: {},
      },
    ],
  });
  await assignInquiryForUser(owner, ORG, created.id, people.adam.staffId);
  const moved = await saveInquiryStageForUser(
    people.adam.userId,
    ORG,
    created.id,
    { fields: created.steps[0]!.fields, lineItems: created.lineItems },
    { complete: true },
  );
  return assignInquiryForUser(owner, ORG, moved.id, people.adam.staffId);
}

const quotationOf = (inquiry: InquiryView) =>
  inquiry.steps.find((step) => step.key === "quotation")!;

const QUOTATION_ANSWERS = {
  quotationDate: appDateValue(),
  vatPercent: "5",
  termPayment: "Cash",
};

before(async () => {
  const [row] =
    await admin`select id from users where is_platform_admin limit 1`;
  assert.ok(row, "run `npm run db:seed` first");
  owner = row.id;

  await createOrganizationForUser(owner, { name: "Paper Works", code: ORG });
  people.adam = await addPerson("Adam", ["admin"]);
  people.mona = await addPerson("Mona", ["management"]);
});

after(async () => {
  await admin.end();
  await (
    globalThis as { postgresClient?: { end: () => Promise<void> } }
  ).postgresClient?.end();
});

describe("what Company Docs lists", () => {
  test("every step, every paper and every signed form is there", async () => {
    const overview = await getCompanyDocsForUser(people.adam.userId, ORG);
    assert.ok(overview);
    assert.deepEqual(
      overview.steps.map((step) => step.stage),
      INQUIRY_STAGES.map((stage) => stage.key),
    );
    for (const step of overview.steps) {
      const papers = STAGE_DEFINITIONS[step.stage].documents.map(
        (doc) => doc.key,
      );
      assert.deepEqual(
        step.docs
          .filter((doc) => doc.kind === "paper")
          .map((doc) => doc.document),
        papers,
      );
    }
    assert.deepEqual(
      overview.forms.map((form) => form.key),
      [...SIGNED_FORM_KEYS],
    );
    // Anyone may look; only Administrators and Management may change.
    assert.equal(overview.canEdit, false);
    assert.equal(
      (await getCompanyDocsForUser(people.mona.userId, ORG))?.canEdit,
      true,
    );
  });

  test("every number code belongs to exactly one document", () => {
    const codes = [
      ...INQUIRY_CATALOG.flatMap((entry) =>
        entry.counterKey ? [entry.counterKey] : [],
      ),
      ...FORM_TYPES.map((type) => FORM_DEFINITIONS[type].counterKey),
    ];
    assert.equal(new Set(codes).size, codes.length);

    // Every code the inquiry process gives out can be set somewhere.
    for (const stage of INQUIRY_STAGES) {
      const definition = STAGE_DEFINITIONS[stage.key];
      for (const code of [
        definition.counterKey,
        ...definition.documents.map((doc) => doc.counterKey),
      ]) {
        if (code) assert.ok(codes.includes(code), `${code} has no owner`);
      }
    }
  });

  test("a paper's wording and details follow the company's settings", () => {
    assert.equal(paperText("quotation", "quotation", "title"), "Quotation");
    assert.equal(
      paperText("quotation", "quotation", "title", {
        quotation: { texts: { title: "Price Offer" } },
      }),
      "Price Offer",
    );

    const asked = (template = {}) =>
      stageFields("quotation", template).map((field) => field.key);
    assert.ok(asked().includes("validUntil"));
    assert.ok(
      !asked({
        quotation: { fields: { validUntil: { asked: false } } },
      }).includes("validUntil"),
    );
    // What the system works from cannot be switched off.
    assert.ok(
      asked({
        quotation: { fields: { vatPercent: { asked: false } } },
      }).includes("vatPercent"),
    );
  });
});

describe("changing a paper", () => {
  let before: InquiryView;

  test("only Administrators and Management may change one", async () => {
    await refused(
      saveCompanyDocForUser(
        people.adam.userId,
        ORG,
        "quotation",
        "quotation",
        await untouched("quotation", "quotation"),
      ),
      /permission/,
    );
  });

  test("what is entered is checked", async () => {
    const input = await untouched("quotation", "quotation");
    const save = (changes: Partial<DocumentSettingsInput>) =>
      saveCompanyDocForUser(people.mona.userId, ORG, "quotation", "quotation", {
        ...input,
        ...changes,
      });

    await refused(save({}), /Nothing was changed/);
    await refused(
      save({ texts: { ...input.texts, title: "  " } }),
      /cannot be empty/,
    );
    await refused(save({ code: "Q" }), /2 to 6 letters or digits/);
    // The tax invoice's code, and a signed form's.
    await refused(save({ code: "INV" }), /belongs to another document/);
    await refused(save({ code: "FN" }), /belongs to another document/);
    await refused(
      saveCompanyDocForUser(people.mona.userId, ORG, "inquiry", "form", {
        ...(await untouched("inquiry", "form")),
        fields: {
          ...(await untouched("inquiry", "form")).fields,
          receivedVia: {
            asked: true,
            required: false,
            prefill: "carrier pigeon",
          },
        },
      }),
      /not one of its choices/,
    );
  });

  test("new papers follow the change; the count of its numbers carries on", async () => {
    before = await jobAtQuotation("Before Trading");
    assert.equal(
      quotationOf(before).documentNumber,
      `${PREFIX}/QTN/${YEAR}/0001`,
    );
    assert.deepEqual(quotationOf(before).template, {});

    const input = await untouched("quotation", "quotation");
    const saved = await saveCompanyDocForUser(
      people.mona.userId,
      ORG,
      "quotation",
      "quotation",
      {
        code: "ofr",
        texts: { ...input.texts, title: "Price Offer", greeting: "" },
        fields: {
          ...input.fields,
          validUntil: { asked: true, required: true, prefill: "" },
          termValidity: { asked: false, required: false, prefill: "" },
          termPayment: { asked: true, required: true, prefill: "50% advance" },
          // Not something a company can switch off.
          vatPercent: { asked: false, required: false, prefill: "5" },
        },
      },
    );
    assert.equal(saved.doc.version, 1);
    assert.equal(saved.doc.changedByName, "Mona");
    assert.equal(saved.doc.numberExample, `${PREFIX}/OFR/${YEAR}/0001`);
    // Only what differs from the built-in version is kept.
    assert.deepEqual(saved.settings, {
      code: "OFR",
      texts: { title: "Price Offer", greeting: "" },
      fields: {
        validUntil: { required: true },
        termValidity: { asked: false },
        termPayment: { prefill: "50% advance" },
      },
    });

    // The job already at the step shows the new version too: it is not
    // finished yet.
    const open = await getInquiryForUser(people.adam.userId, ORG, before.id);
    assert.deepEqual(quotationOf(open!).template, {
      quotation: saved.settings,
    });

    const next = await jobAtQuotation("After Trading");
    assert.equal(
      quotationOf(next).documentNumber,
      `${PREFIX}/OFR/${YEAR}/0002`,
    );
  });

  test("a detail made required holds the step; one switched off does not", async () => {
    const save = (fields: Record<string, string>) =>
      saveInquiryStageForUser(
        people.adam.userId,
        ORG,
        before.id,
        { fields, lineItems: before.lineItems },
        { complete: true },
      );
    await refused(save(QUOTATION_ANSWERS), /Still needed: Valid Until\./);

    const moved = await save({
      ...QUOTATION_ANSWERS,
      validUntil: appDateValue(),
    });
    assert.equal(moved.currentStage, "lpo");
    assert.equal(quotationOf(moved).state, "done");
  });

  test("a finished step keeps its papers as they were issued", async () => {
    const issuedWith = quotationOf(
      (await getInquiryForUser(people.adam.userId, ORG, before.id))!,
    ).template;
    assert.equal(issuedWith.quotation?.texts?.title, "Price Offer");

    const input = await untouched("quotation", "quotation");
    await saveCompanyDocForUser(
      people.mona.userId,
      ORG,
      "quotation",
      "quotation",
      {
        ...input,
        code: "OFR",
        texts: { ...input.texts, title: "Offer" },
      },
    );

    const finished = await getInquiryForUser(
      people.adam.userId,
      ORG,
      before.id,
    );
    assert.deepEqual(quotationOf(finished!).template, issuedWith);

    // Sent back, the step is open again and follows the papers as they are.
    await assignInquiryForUser(owner, ORG, before.id, people.adam.staffId);
    const reopened = await sendInquiryBackForUser(
      people.adam.userId,
      ORG,
      before.id,
      "Price changed",
    );
    assert.equal(
      quotationOf(reopened).template.quotation?.texts?.title,
      "Offer",
    );
  });

  test("going back to an earlier version, and to the built-in one", async () => {
    const back = await restoreCompanyDocVersionForUser(
      people.mona.userId,
      ORG,
      "quotation",
      "quotation",
      1,
    );
    assert.equal(back.doc.version, 3);
    assert.equal(back.settings.texts?.title, "Price Offer");
    assert.deepEqual(
      back.versions.map((item) => [item.version, item.note]),
      [
        [3, "Back to version 1"],
        [2, ""],
        [1, ""],
      ],
    );
    await refused(
      restoreCompanyDocVersionForUser(
        people.mona.userId,
        ORG,
        "quotation",
        "quotation",
        9,
      ),
      /does not exist/,
    );

    const builtIn = await restoreCompanyDocVersionForUser(
      people.mona.userId,
      ORG,
      "quotation",
      "quotation",
      0,
    );
    assert.deepEqual(builtIn.settings, {});
    assert.equal(builtIn.doc.numberExample, `${PREFIX}/QTN/${YEAR}/0001`);
    // The count still carries on under the old code.
    const next = await jobAtQuotation("Later Trading");
    assert.equal(
      quotationOf(next).documentNumber,
      `${PREFIX}/QTN/${YEAR}/0003`,
    );
  });

  test("a code another paper has used is never given to a second one", async () => {
    await refused(
      saveCompanyDocForUser(
        people.mona.userId,
        ORG,
        "proforma_invoice",
        "proforma_invoice",
        {
          ...(await untouched("proforma_invoice", "proforma_invoice")),
          code: "OFR",
        },
      ),
      /belongs to another document/,
    );
  });

  test("the inquiry's own number and details can be changed too", async () => {
    const input = await untouched("inquiry", "form");
    await saveCompanyDocForUser(people.mona.userId, ORG, "inquiry", "form", {
      ...input,
      code: "ENQ",
      fields: {
        ...input.fields,
        email: { asked: true, required: true, prefill: "" },
      },
    });

    const created = await createInquiryForUser(people.adam.userId, ORG, {
      fields: { customerName: "Numbered Trading", title: "Gate", contact: "1" },
      lineItems: [],
    });
    assert.equal(created.number, `${PREFIX}/ENQ/${YEAR}/0004`);

    await assignInquiryForUser(owner, ORG, created.id, people.adam.staffId);
    await refused(
      saveInquiryStageForUser(
        people.adam.userId,
        ORG,
        created.id,
        { fields: created.steps[0]!.fields, lineItems: [] },
        { complete: true },
      ),
      /Still needed: Email address\./,
    );

    const detail = await getCompanyDocForUser(
      people.adam.userId,
      ORG,
      "inquiry",
      "form",
    );
    assert.equal(detail?.doc.used, 4);
    assert.equal(detail?.canEdit, false);
  });
});
