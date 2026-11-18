import type postgres from "postgres";
import { addDays } from "@/lib/datetime/calendar";
import { appDateValue } from "@/lib/datetime/format";
import {
  approveInquiryStageForUser,
  assignInquiryForUser,
  closeInquiryForUser,
  createInquiryForUser,
  getInquiryForUser,
  getInquiryWorkflowMapForUser,
  saveInquiryStageForUser,
  saveInquiryWorkflowMapForUser,
} from "@/lib/inquiries/queries";
import {
  INQUIRY_STAGES,
  type InquiryStageKey,
  type InquiryWorkflowDepartmentKey,
} from "@/lib/inquiries/stages";
import type { InquiryLineItemInput } from "@/lib/inquiries/types";
import { UserError } from "@/lib/errors";

type Person = { userId: string; staffId: string };

/** Who handles each step in the demo company. */
const STEP_DEPARTMENTS: Record<InquiryStageKey, InquiryWorkflowDepartmentKey> =
  {
    inquiry: "admin",
    quotation: "admin",
    lpo_in_or_out: "admin",
    proforma_invoice: "accounts",
    job_card: "engineering",
    progress_invoice: "accounts",
    delivery_note: "admin",
    tax_invoice: "accounts",
    receipt_voucher: "accounts",
  };

type DemoInquiry = {
  customer: string;
  contactPerson: string;
  phone: string;
  title: string;
  jobType?: "export";
  /** Days from today the customer needs it by. */
  neededIn: number;
  items: [description: string, quantity: string, unit: string, price: string][];
  /** The step it is left at; "done" runs it to the end. */
  reach: InquiryStageKey | "done";
  /** Leave the step it stops at without anyone assigned. */
  unassigned?: boolean;
  lostBecause?: string;
};

const DEMO_INQUIRIES: DemoInquiry[] = [
  {
    customer: "Gulf Marine Services LLC",
    contactPerson: "Mr. Anwar",
    phone: "04 555 0142",
    title: "SS handrail for jetty walkway",
    neededIn: 21,
    items: [["SS 316 handrail, 42 mm dia", "36", "m", "0"]],
    reach: "inquiry",
    unassigned: true,
  },
  {
    customer: "Barton Engineering",
    contactPerson: "Mr. Nazmul",
    phone: "050 555 0177",
    title: "GI pipe supports, 40 nos",
    neededIn: 14,
    items: [
      ['GI pipe support 2", galvanised', "40", "Nos", "85"],
      ["Site installation", "1", "Lot", "1200"],
    ],
    reach: "quotation",
  },
  {
    customer: "Al Noor Contracting",
    contactPerson: "Eng. Samir",
    phone: "06 555 0119",
    title: "MS staircase with railing",
    neededIn: 30,
    items: [
      ["MS staircase, 14 steps, painted", "1", "Set", "9800"],
      ["MS railing both sides", "9", "m", "420"],
    ],
    reach: "lpo_in_or_out",
    unassigned: true,
  },
  {
    customer: "Emirates Steel Trading",
    contactPerson: "Mr. Joseph",
    phone: "04 555 0163",
    title: "Machining of flanges, 6 inch",
    neededIn: 10,
    items: [['Flange 6" facing and drilling', "24", "Nos", "140"]],
    reach: "job_card",
  },
  {
    customer: "Delta Marine FZE",
    contactPerson: "Capt. Imran",
    phone: "050 555 0131",
    title: "Aluminium gangway repair",
    jobType: "export",
    neededIn: 5,
    items: [
      ["Gangway frame welding repair", "1", "Job", "6400"],
      ["Anti-slip tread plates", "12", "Nos", "180"],
    ],
    reach: "delivery_note",
  },
  {
    customer: "Sharjah Cement Works",
    contactPerson: "Mr. Prakash",
    phone: "06 555 0188",
    title: "Feed hopper fabrication",
    neededIn: -4,
    items: [["MS feed hopper 2 m³, primed", "2", "Nos", "7250"]],
    reach: "tax_invoice",
  },
  {
    customer: "Oasis Interiors",
    contactPerson: "Ms. Reem",
    phone: "04 555 0155",
    title: "Decorative SS screens",
    neededIn: -20,
    items: [["SS mirror-finish screen 1.2 × 2.4 m", "6", "Nos", "2150"]],
    reach: "done",
  },
  {
    customer: "Mr. Faisal (walk-in)",
    contactPerson: "",
    phone: "055 555 0104",
    title: "Sliding gate repair",
    neededIn: 7,
    items: [["Sliding gate track and roller repair", "1", "Job", "0"]],
    reach: "inquiry",
    lostBecause: "Customer went with another workshop",
  },
];

/** Plausible answers for every step after the first two. */
function stepAnswers(
  stage: InquiryStageKey,
  day: string,
  total: number,
): Record<string, string> {
  switch (stage) {
    case "lpo_in_or_out":
      return {
        customerLpoNumber: `LPO-${Math.round(total)}`,
        customerLpoDate: day,
        customerLpoAmount: total.toFixed(2),
      };
    case "proforma_invoice":
      return {
        proformaDate: day,
        advancePercent: "50",
        advanceAmount: (total / 2).toFixed(2),
        advanceReceived: "yes",
      };
    case "job_card":
      return {
        startDate: day,
        supervisor: "Hakeem",
        technicians: "Robel, Hasan, Salim",
        instructions: "As per approved drawing. Check dimensions before welding.",
      };
    case "progress_invoice":
      return { invoiceDate: day, progressPercent: "50" };
    case "delivery_note":
      return { deliveryDate: day, receivedBy: "Site storekeeper" };
    case "tax_invoice":
      return { invoiceDate: day, paymentTerms: "30 days" };
    case "receipt_voucher":
      return {
        receiptDate: day,
        amountReceived: total.toFixed(2),
        paymentMethod: "bank_transfer",
      };
    default:
      return {};
  }
}

/**
 * Loads demo inquiries at different steps of the process, so every screen
 * has something to show. Does nothing if they are already there.
 */
export async function loadDemoInquiries(
  admin: postgres.Sql,
  ownerId: string,
  orgCode: string,
) {
  const [loaded] = await admin`
    select 1 from inquiries i
    join organizations o on o.id = i.organization_id
    where o.code = ${orgCode} and i.title = ${DEMO_INQUIRIES[0]!.title}
  `;
  if (loaded) return;

  const logins = await admin<
    { username: string; userId: string; staffId: string }[]
  >`
    select u.username, u.id as "userId", s.id as "staffId"
    from users u
    join staff_members s on s.user_id = u.id
    join organizations o on o.id = s.organization_id
    where o.code = ${orgCode} and s.status = 'active'
  `;
  const person = (username: string): Person | undefined =>
    logins.find((login) => login.username === username);
  const handlers: Partial<Record<InquiryWorkflowDepartmentKey, Person>> = {
    admin: person("rameez"),
    engineering: person("hakeem"),
    accounts: person("tabassum"),
  };
  const approver = person("abu");
  if (!handlers.admin || !handlers.engineering || !handlers.accounts || !approver) {
    console.log("Demo inquiries skipped: the demo logins are not all there.");
    return;
  }

  // Set who handles each step, unless the company has already chosen.
  const map = await getInquiryWorkflowMapForUser(ownerId, orgCode);
  if (!map) return;
  const untouched = INQUIRY_STAGES.every(
    (stage) =>
      map[stage.key].departmentKey === "admin" &&
      !map[stage.key].approvalRequired,
  );
  if (untouched) {
    for (const stage of INQUIRY_STAGES) {
      map[stage.key] = {
        departmentKey: STEP_DEPARTMENTS[stage.key],
        approvalRequired: stage.key === "quotation",
        approvalRequiredBy: stage.key === "quotation" ? "management" : "",
      };
    }
    await saveInquiryWorkflowMapForUser(ownerId, orgCode, map);
  }

  console.log("Loading demo inquiries...");
  const today = appDateValue();

  for (const demo of DEMO_INQUIRIES) {
    const lineItems: InquiryLineItemInput[] = demo.items.map(
      ([description, quantity, unit, unitPrice]) => ({
        description,
        quantity,
        unit,
        unitPrice,
        deliveredQuantity: "",
      }),
    );
    const inquiryFields = {
      customerName: demo.customer,
      contactPerson: demo.contactPerson,
      contact: demo.phone,
      title: demo.title,
      jobType: demo.jobType ?? "local",
      receivedVia: "phone",
      deliveryExpectedOn: addDays(today, demo.neededIn),
      details: `${demo.title}. Drawing to follow from the customer.`,
    };

    // If the company's own settings get in the way (a step handled by a
    // department with no demo person), the inquiry stays where it got to.
    try {
      const created = await createInquiryForUser(
        handlers.admin.userId,
        orgCode,
        { fields: inquiryFields, lineItems },
      );
      if (demo.lostBecause) {
        await closeInquiryForUser(ownerId, orgCode, created.id, demo.lostBecause);
      } else {
        await advance(demo, created.id, inquiryFields);
      }
    } catch (error) {
      if (!(error instanceof UserError)) throw error;
      console.log(`  ${demo.title}: stopped early (${error.message})`);
    }
  }

  console.log(`Demo inquiries loaded: ${DEMO_INQUIRIES.length}.`);

  /** Work through the steps up to the one this inquiry is left at. */
  async function advance(
    demo: DemoInquiry,
    id: string,
    inquiryFields: Record<string, string>,
  ) {
    if (!handlers.admin || !approver) return;
    const stopAt =
      demo.reach === "done"
        ? INQUIRY_STAGES.length
        : INQUIRY_STAGES.findIndex((stage) => stage.key === demo.reach);

    for (const [index, stage] of INQUIRY_STAGES.entries()) {
      const last = index === stopAt;
      if (index > stopAt || (last && demo.unassigned)) break;

      const view = await getInquiryForUser(ownerId, orgCode, id);
      if (!view || view.status !== "open") break;
      const handler = handlers[view.owningDepartmentKey] ?? handlers.admin;
      await assignInquiryForUser(ownerId, orgCode, id, handler.staffId);

      const fields =
        stage.key === "inquiry"
          ? inquiryFields
          : stage.key === "quotation"
            ? {
                quotationDate: today,
                validUntil: addDays(today, 30),
                attention: demo.contactPerson,
                subject: demo.title,
                vatPercent: "5",
                paymentTerms: "50% advance, balance on delivery",
                deliveryPeriod: "2 weeks from LPO",
              }
            : stepAnswers(stage.key, today, view.totals.total);
      const items = view.lineItems.map((line, lineIndex) => ({
        ...line,
        unitPrice: demo.items[lineIndex]?.[3] ?? line.unitPrice,
        deliveredQuantity: line.quantity,
      }));

      // The step it stops at is saved but not completed.
      await saveInquiryStageForUser(
        handler.userId,
        orgCode,
        id,
        { fields, lineItems: items },
        { complete: false },
      );
      if (last) break;

      if (view.steps[index]?.approvalRequired) {
        await approveInquiryStageForUser(approver.userId, orgCode, id);
      }
      await saveInquiryStageForUser(
        handler.userId,
        orgCode,
        id,
        { fields, lineItems: items },
        { complete: true },
      );
    }
  }
}
