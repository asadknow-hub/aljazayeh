/**
 * A made-up job, so Company Docs can show every paper filled in the way it
 * will print. Nothing here is saved anywhere.
 */
import { overtimePay } from "@/lib/forms/overtime";
import { addDays } from "@/lib/datetime/calendar";
import type { FormType } from "@/lib/forms/definitions";
import { stagesForJob, type InquiryStageKey } from "@/lib/inquiries/stages";
import {
  INQUIRY_COUNTER_KEY,
  inquiryTotals,
  isComputedPrefill,
  mainDocument,
  numberCode,
  STAGE_DEFINITIONS,
  STEP_FORM,
  stageFields,
  type StageField,
  type StepTemplate,
} from "@/lib/inquiries/stage-forms";
import type {
  InquiryLineItemView,
  InquiryView,
  StageTables,
} from "@/lib/inquiries/types";

type Templates = Partial<Record<InquiryStageKey, StepTemplate>>;

const CUSTOMER = {
  name: "Al Noor Contracting LLC",
  address: "Industrial Area 11, Sharjah",
};

/** What the sample job answers, where the type of a detail is not enough. */
const ANSWERS: Record<string, string> = {
  title: "MS staircase with railing",
  customerName: CUSTOMER.name,
  contactPerson: "Eng. Samir",
  contact: "06 555 0119",
  email: "samir@alnoor.example",
  customerTrn: "100456789000003",
  customerAddress: CUSTOMER.address,
  receivedVia: "email",
  details: "Staircase for the warehouse mezzanine, painted finish.",
  discount: "250",
  termMaterial: "Mild steel to ASTM A36, primer and two coats of paint",
  termDelivery: "Delivered to site in Sharjah",
  termLeadTime: "3 weeks from LPO",
  termPayment: "50% advance, balance on delivery",
  termValidity: "30 days",
  lpoType: "customer",
  customerLpoNumber: "PO-77812",
  supplierName: "Gulf Steel Supplies LLC",
  supplierPhone: "04 555 0190",
  supplierEmirate: "Dubai",
  supplierTrn: "100998877600003",
  poPaymentMode: "30 days credit",
  poSupplierRef: "GSS/Q/1182",
  poDespatch: "Supplier's vehicle",
  poDestination: "Jebel Ali Industrial Area 3",
  poDeliveryTerms: "Delivered to workshop",
  poTerms: "Material test certificates to be supplied with the delivery.",
  paymentTerms: "30 days credit",
  advancePercent: "50",
  technician1: "Anik",
  technician2: "Rubel",
  supervisor: "Hakeem",
  startTime: "08:00",
  endTime: "17:00",
  technicianHours: "96",
  overtimeHours: "8",
  technicianRemarks: "Check the weld finish before painting.",
  coatingChemicalManufacturer: "Atotech",
  thicknessReadings: "8.2 / 8.6 / 9.1 µm",
  progressPercent: "60",
  workDetails:
    "Staircase frame cut, welded and primed.\nRailing posts fixed on both sides; handrail still to be fitted.",
  creditLimit: "50000",
  previousOutstanding: "0",
  ciPaymentTerms: "Advance by bank transfer",
  deliverySiteAddress: "Plot 14, Rusayl Industrial Estate, Muscat",
  siteContactPerson: "Mr. Hamed",
  siteContact: "+968 555 0144",
  finalDestination: "Muscat, Oman",
  carrier: "Al Madina Freight",
  vehicleNumber: "D 48213",
  portOfLoading: "Jebel Ali",
  totalGrossWeight: "1240",
  paymentMethod: "bank_transfer",
  reference: "TT-20931",
  bank: "Emirates NBD",
  remarks: "Tax invoice in full",
};

const TABLES: StageTables = {
  notes: [
    {
      heading: "Additional Work",
      text: "Any work outside this quotation is quoted and approved separately before it starts.",
    },
    {
      heading: "Project Completion Period",
      text: "Three weeks from the LPO and the advance payment.",
    },
  ],
  poLines: [
    {
      description: "MS plate 10 mm, 1220 x 2440",
      quantity: "6 Nos",
      rate: "620",
    },
    {
      description: "MS pipe 42 mm, 6 m length",
      quantity: "12 Nos",
      rate: "95",
    },
  ],
  packages: [
    {
      mark: "ANC-01",
      packageType: "Wooden crate",
      grossWeight: "820 KG",
      dimensions: "300 x 120 x 90 cm",
    },
    {
      mark: "ANC-02",
      packageType: "Pallet, wrapped",
      grossWeight: "420 KG",
      dimensions: "240 x 100 x 60 cm",
    },
  ],
};

const ITEMS: InquiryLineItemView[] = [
  {
    id: "sample-1",
    description: "MS staircase, 14 steps, painted",
    quantity: "1",
    unit: "Set",
    unitPrice: "9800",
    deliveredQuantity: "1",
    details: {
      jobRemark: "Chequered plate treads",
      heatNo: "H-48211",
      origin: "UAE",
      complianceRemark: "Complies",
      deliveryRemark: "Complete",
      hsCode: "7308.90",
      packNo: "ANC-01",
    },
  },
  {
    id: "sample-2",
    description: "MS railing, both sides",
    quantity: "9",
    unit: "m",
    unitPrice: "420",
    deliveredQuantity: "9",
    details: {
      jobRemark: "42 mm pipe",
      heatNo: "H-48377",
      origin: "UAE",
      complianceRemark: "Complies",
      deliveryRemark: "Complete",
      hsCode: "7308.90",
      packNo: "ANC-02",
    },
  },
];

/** Dates the sample job gives, in days from today. */
const DATE_OFFSETS: Record<string, number> = {
  deliveryExpectedOn: 21,
  validUntil: 30,
  customerLpoDate: -2,
  dueDate: 30,
  endDate: 10,
};

function answerOf(
  field: StageField,
  builtIn: StageField,
  today: string,
  total: number,
): string {
  // A starting value the company typed is what staff will see first.
  if (field.prefill !== builtIn.prefill) return field.prefill ?? "";
  if (field.prefill === "grandTotal") return total.toFixed(2);
  if (field.prefill === "customerName") return CUSTOMER.name;
  if (field.prefill === "customerAddress") return CUSTOMER.address;
  if (field.key in ANSWERS) return ANSWERS[field.key]!;
  if (field.prefill && !isComputedPrefill(field.prefill)) return field.prefill;
  if (field.type === "date") {
    return addDays(today, DATE_OFFSETS[field.key] ?? 0);
  }
  if (field.type === "yesno") return "yes";
  if (field.type === "choice") return field.options?.[0]?.value ?? "";
  return "";
}

/**
 * The sample job with every step finished. `show` is the paper being looked
 * at: the answers are set so that this paper is one the job needs.
 */
export function sampleInquiry(options: {
  today: string;
  jobType: "local" | "export";
  templates: Templates;
  show: { stage: InquiryStageKey; document: string };
}): InquiryView {
  const { today, jobType, templates, show } = options;
  const year = today.slice(0, 4);
  const number = (counterKey: string, template: StepTemplate, owner: string) =>
    `${numberCode(counterKey, template[owner])}/${year}/0042`;
  const total = inquiryTotals(ITEMS, {
    discount: ANSWERS.discount!,
    vatPercent: "5",
  }).total;

  const steps = stagesForJob(jobType).map((stage, index) => {
    const definition = STAGE_DEFINITIONS[stage.key];
    const template = templates[stage.key] ?? {};
    const builtIn = new Map(
      definition.fields.map((field) => [field.key, field]),
    );
    const fields = Object.fromEntries(
      stageFields(stage.key, template).map((field) => [
        field.key,
        answerOf(field, builtIn.get(field.key)!, today, total),
      ]),
    );
    if (stage.key === "inquiry") fields.jobType = jobType;
    // The paper on screen has to be one this job needs.
    const wanted = definition.documents.find(
      (doc) => stage.key === show.stage && doc.key === show.document,
    )?.enabledWhen;
    if (wanted) fields[wanted.field] = wanted.value;

    const main = mainDocument(stage.key);
    const counterKey = main?.counterKey ?? definition.counterKey;
    return {
      key: stage.key,
      number: index + 1,
      label: stage.label,
      departmentKey: "admin" as const,
      state: "done" as const,
      documentNumber:
        stage.key === "inquiry"
          ? number(INQUIRY_COUNTER_KEY, template, STEP_FORM)
          : counterKey
            ? number(counterKey, template, main?.key ?? STEP_FORM)
            : "",
      documentNumbers: Object.fromEntries(
        definition.documents.flatMap((doc) =>
          doc.enabledWhen && doc.counterKey
            ? [[doc.key, number(doc.counterKey, template, doc.key)]]
            : [],
        ),
      ),
      fields,
      tables: Object.fromEntries(
        Object.keys(definition.tables).map((name) => [
          name,
          TABLES[name] ?? [],
        ]),
      ),
      template,
      bank: null,
      handlerStaffId: null,
      handlerName: "Rameez",
      canPlan: false,
      preparedByName: "Rameez",
      completedAt: `${today}T08:00:00.000Z`,
      completedByName: "Rameez",
      approvalRequired: false,
      approvalBy: "",
    };
  });

  const inquiryStep = steps[0]!;
  return {
    id: "sample",
    number: inquiryStep.documentNumber,
    title: ANSWERS.title!,
    customerName: CUSTOMER.name,
    contact: ANSWERS.contact!,
    deliveryExpectedOn: addDays(today, DATE_OFFSETS.deliveryExpectedOn!),
    jobType,
    status: "completed",
    currentStage: steps.at(-1)!.key,
    daysInStage: 0,
    overdue: false,
    owningDepartmentKey: "admin",
    assignedStaffId: null,
    assignedStaffName: null,
    totals: inquiryTotals(
      ITEMS,
      steps.find((step) => step.key === "quotation")?.fields,
    ),
    canWork: false,
    canAssign: false,
    createdAt: `${today}T08:00:00.000Z`,
    updatedAt: `${today}T08:00:00.000Z`,
    closeReason: "",
    closedAt: null,
    source: "admin",
    createdByName: "Rameez",
    steps,
    lineItems: ITEMS,
    bankAccounts: [],
    attachments: [],
    approvalRequested: false,
    currentStageApproved: false,
    canApproveCurrentStage: false,
    canClose: false,
    comments: [],
    activityLogs: [],
  };
}

/* ------------------------------ signed forms ------------------------------ */

/** The employee the sample forms are about, and who raises them. */
export const SAMPLE_EMPLOYEE = { fullName: "Anik", jobTitle: "Welder" };
export const SAMPLE_RAISER = { fullName: "Rameez", jobTitle: "Admin" };

/** What the sample of each signed form says. */
export function sampleFormAnswers(
  type: FormType,
  today: string,
): { fields: Record<string, string>; lines: Record<string, string>[] } {
  switch (type) {
    case "fine_notice":
      return {
        fields: {
          reason: "been late to work three times this week",
          amount: "50",
        },
        lines: [],
      };
    case "medical_claim":
      return {
        fields: {
          date: today,
          hospital: "Aster Clinic, Al Quoz",
          total: "300",
        },
        lines: [],
      };
    case "petty_cash":
      return {
        fields: {
          projectName: "GENERAL PETTY CASH",
          description: "Workshop consumables",
          requestDate: today,
        },
        lines: [
          {
            receivedAmount: "500",
            paidBy: "Hakeem",
            description: "Welding rods",
            invoiceQty: "1",
            invoiceAmount: "245.50",
          },
          {
            vehicleNo: "D 48213",
            paidBy: "Hakeem",
            description: "Diesel for pickup",
            invoiceQty: "1",
            invoiceAmount: "120",
          },
        ],
      };
    case "material_request":
      return {
        fields: {
          projectName: "MS staircase with railing",
          section: "Fabrication",
          description: "Material for the staircase",
          requestDate: today,
          jobNo: "JC/0042",
        },
        lines: [
          {
            materialDescription: "MS plate 10 mm, 1220 x 2440",
            qty: "6",
            approvalStatus: "Approved",
            specification: "ASTM A36",
          },
          {
            materialDescription: "MS pipe 42 mm, 6 m",
            qty: "12",
            approvalStatus: "Approved",
            specification: "ASTM A53",
          },
        ],
      };
    case "verbal_work_approval":
      return {
        fields: {
          projectName: "Gate hinge repair",
          requestedBy: "Mr. Anwar, by phone",
          description: "Replace two hinges on the sliding gate",
          customerName: CUSTOMER.name,
          requestDate: today,
          deliveryDate: addDays(today, 2),
        },
        lines: [
          {
            approvedBy: "Hakeem",
            materialDescription: "Heavy duty hinge, welded",
            qty: "2",
            jobPrice: "180",
          },
        ],
      };
    case "overtime":
      return {
        fields: { date: today, food: "30" },
        lines: [
          {
            name: "Anik",
            employeeId: "EMP-0023",
            startTime: "18:00",
            endTime: "21:00",
            hours: "3",
            jobProgress: "Welding the staircase stringers",
            clientName: CUSTOMER.name,
            ...samplePay(1800, 3),
          },
          {
            name: "Jubair",
            employeeId: "EMP-0021",
            startTime: "18:00",
            endTime: "20:00",
            hours: "2",
            jobProgress: "Grinding and primer",
            clientName: CUSTOMER.name,
            ...samplePay(1500, 2),
          },
        ],
      };
  }
}

/** A sample line's pay, written the way a filed sheet keeps it. */
function samplePay(salary: number, hours: number): Record<string, string> {
  return Object.fromEntries(
    Object.entries(overtimePay(salary, hours)).map(([key, value]) => [
      key,
      value.toFixed(2),
    ]),
  );
}
