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
  requestInquiryApprovalForUser,
  saveInquiryStageForUser,
  saveInquiryWorkflowMapForUser,
  uploadInquiryAttachmentForUser,
} from "@/lib/inquiries/queries";
import {
  INQUIRY_STAGES,
  stagesForJob,
  type InquiryStageKey,
  type InquiryWorkflowDepartmentKey,
} from "@/lib/inquiries/stages";
import type { InquiryLineItemInput } from "@/lib/inquiries/types";
import { UserError } from "@/lib/errors";
import { OWNERS_APPROVE } from "@/lib/inquiries/approvers";

type Person = { userId: string; staffId: string };

/** Who handles each step in the demo company. */
const STEP_DEPARTMENTS: Record<InquiryStageKey, InquiryWorkflowDepartmentKey> =
  {
    inquiry: "admin",
    quotation: "admin",
    lpo: "admin",
    proforma_invoice: "accounts",
    job_card: "admin",
    progress_invoice: "accounts",
    delivery_note: "admin",
    tax_invoice: "accounts",
    commercial_invoice: "admin",
    receipt_voucher: "accounts",
  };

type DemoInquiry = {
  customer: string;
  contactPerson: string;
  phone: string;
  email: string;
  trn: string;
  address: string;
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
    email: "anwar@gulfmarine.example",
    trn: "100234567800003",
    address: "Warehouse 12, Al Quoz Industrial 3, Dubai",
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
    email: "nazmul@barton.example",
    trn: "100345678900003",
    address: "Office 4, Ras Al Khor Industrial 2, Dubai",
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
    email: "samir@alnoor.example",
    trn: "100456789000003",
    address: "Industrial Area 11, Sharjah",
    title: "MS staircase with railing",
    neededIn: 30,
    items: [
      ["MS staircase, 14 steps, painted", "1", "Set", "9800"],
      ["MS railing both sides", "9", "m", "420"],
    ],
    reach: "lpo",
    unassigned: true,
  },
  {
    customer: "Emirates Steel Trading",
    contactPerson: "Mr. Joseph",
    phone: "04 555 0163",
    email: "joseph@emiratessteel.example",
    trn: "100567890100003",
    address: "Plot 88, Jebel Ali Free Zone, Dubai",
    title: "Machining of flanges, 6 inch",
    neededIn: 10,
    items: [['Flange 6" facing and drilling', "24", "Nos", "140"]],
    reach: "job_card",
  },
  {
    customer: "Delta Marine FZE",
    contactPerson: "Capt. Imran",
    phone: "050 555 0131",
    email: "imran@deltamarine.example",
    trn: "100678901200003",
    address: "Quay 3, Hamriyah Free Zone, Sharjah",
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
    email: "prakash@sharjahcement.example",
    trn: "100789012300003",
    address: "Al Dhaid Road, Sharjah",
    title: "Feed hopper fabrication",
    neededIn: -4,
    items: [["MS feed hopper 2 m³, primed", "2", "Nos", "7250"]],
    reach: "tax_invoice",
  },
  {
    customer: "Oasis Interiors",
    contactPerson: "Ms. Reem",
    phone: "04 555 0155",
    email: "reem@oasisinteriors.example",
    trn: "100890123400003",
    address: "Showroom 7, Umm Ramool, Dubai",
    title: "Decorative SS screens",
    neededIn: -20,
    items: [["SS mirror-finish screen 1.2 × 2.4 m", "6", "Nos", "2150"]],
    reach: "done",
  },
  {
    customer: "Muscat Steel Works LLC",
    contactPerson: "Mr. Salim Al Harthy",
    phone: "+968 2455 0170",
    email: "salim@muscatsteel.example",
    trn: "",
    address: "Rusayl Industrial Estate, Muscat, Oman",
    title: "Galvanised pipe spools for export",
    jobType: "export",
    neededIn: 12,
    items: [
      ['GI pipe spool 4", flanged both ends', "18", "Nos", "640"],
      ["Export crating", "2", "Nos", "450"],
    ],
    reach: "commercial_invoice",
  },
  {
    customer: "Mr. Faisal (walk-in)",
    contactPerson: "",
    phone: "055 555 0104",
    email: "",
    trn: "",
    address: "",
    title: "Sliding gate repair",
    neededIn: 7,
    items: [["Sliding gate track and roller repair", "1", "Job", "0"]],
    reach: "inquiry",
    lostBecause: "Customer went with another workshop",
  },
];

/** A one-page PDF with a line of text, as a data URL. */
function samplePdf(text: string): string {
  const stream = `BT /F1 16 Tf 60 760 Td (${text.replace(/[()\\]/g, "")}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return `data:application/pdf;base64,${Buffer.from(pdf, "latin1").toString("base64")}`;
}

/** Plausible answers for every step after the first two. */
function stepAnswers(
  stage: InquiryStageKey,
  day: string,
  total: number,
): Record<string, string> {
  switch (stage) {
    case "lpo":
      return {
        lpoType: "customer",
        customerLpoNumber: `LPO-${Math.round(total)}`,
        customerLpoDate: day,
        customerLpoAmount: total.toFixed(2),
      };
    case "proforma_invoice":
      return {
        proformaDate: day,
        paymentTerms: "50% advance",
        advancePercent: "50",
      };
    case "job_card":
      return {
        expectedDelivery: addDays(day, 10),
        technician1: "Robel",
        technician2: "Hasan",
        supervisor: "Hakeem",
      };
    case "progress_invoice":
      return { invoiceDate: day, progressPercent: "50" };
    case "delivery_note":
      return { deliveryDate: day };
    case "tax_invoice":
      return {
        invoiceDate: day,
        paymentTerms: "30 Days Credit",
        dueDate: addDays(day, 30),
      };
    case "commercial_invoice":
      return { ciDate: day, ciPaymentTerms: "30 Days Credit" };
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
 * The first version of the demo gave the Job Card to Engineering. The
 * company's own job card says Admin prepares it, so a demo company still on
 * that first arrangement is put right.
 */
export async function alignDemoWorkflow(ownerId: string, orgCode: string) {
  const map = await getInquiryWorkflowMapForUser(ownerId, orgCode);
  if (!map || map.job_card.departmentKey !== "engineering") return;

  const firstVersion = INQUIRY_STAGES.every(
    (stage) =>
      stage.key === "job_card" ||
      stage.key === "commercial_invoice" ||
      map[stage.key].departmentKey === STEP_DEPARTMENTS[stage.key],
  );
  if (!firstVersion) return;

  map.job_card = { ...map.job_card, departmentKey: "admin" };
  await saveInquiryWorkflowMapForUser(ownerId, orgCode, map);
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

  // Quotations need an owner's approval in the demo, unless the company has
  // already set up approvals of its own.
  const map = await getInquiryWorkflowMapForUser(ownerId, orgCode);
  if (!map) return;
  const untouched = INQUIRY_STAGES.every(
    (stage) => !map[stage.key].approvalRequired,
  );
  if (untouched) {
    for (const stage of INQUIRY_STAGES) {
      map[stage.key] = {
        departmentKey: STEP_DEPARTMENTS[stage.key],
        approvalRequired: stage.key === "quotation",
        approvalRequiredBy: stage.key === "quotation" ? OWNERS_APPROVE : "",
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
        details: {},
      }),
    );
    const inquiryFields = {
      customerName: demo.customer,
      contactPerson: demo.contactPerson,
      contact: demo.phone,
      email: demo.email,
      customerTrn: demo.trn,
      customerAddress: demo.address,
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
    const stages = stagesForJob(demo.jobType ?? "local");
    const stopAt =
      demo.reach === "done"
        ? stages.length
        : stages.findIndex((stage) => stage.key === demo.reach);

    for (const [index, stage] of stages.entries()) {
      const last = index === stopAt;
      if (index > stopAt || (last && demo.unassigned)) break;

      const view = await getInquiryForUser(ownerId, orgCode, id);
      if (!view || view.status !== "open") break;
      const handler = handlers[view.owningDepartmentKey] ?? handlers.admin;
      await assignInquiryForUser(ownerId, orgCode, id, handler.staffId);

      const fields: Record<string, string> =
        stage.key === "inquiry"
          ? inquiryFields
          : stage.key === "quotation"
            ? {
                quotationDate: today,
                validUntil: addDays(today, 30),
                vatPercent: "5",
                termMaterial: "As per approved drawing and customer specification",
                termDelivery: "Ex-works, Jebel Ali Industrial Area 3",
                termLeadTime: "2 weeks from LPO",
                termPayment: "50% advance, balance on delivery",
                termValidity: "30 days",
              }
            : stepAnswers(stage.key, today, view.totals.total);
      if (stage.key === "lpo") {
        // A stand-in for the LPO the customer would have sent.
        const file = await uploadInquiryAttachmentForUser(
          handler.userId,
          orgCode,
          id,
          {
            fileName: `${fields.customerLpoNumber}.pdf`,
            dataUrl: samplePdf(
              `${demo.customer} - LPO ${fields.customerLpoNumber} (sample)`,
            ),
          },
        );
        fields.customerLpoFile = file.id;
      }
      const items = view.lineItems.map((line, lineIndex) => ({
        ...line,
        unit: demo.items[lineIndex]?.[2] ?? line.unit,
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
        await requestInquiryApprovalForUser(handler.userId, orgCode, id, {
          fields,
          lineItems: items,
        });
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
