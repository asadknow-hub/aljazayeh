/**
 * What each step of the inquiry process produces and asks for.
 *
 * An inquiry is one job, from the first request to the money being received.
 * Every step has its paperwork: the Quotation step has the quotation, the Job
 * Card step has the job card and its certificates, and so on. This file says,
 * per step, which documents it has, what is written on them by hand, and what
 * must be there before the job can move on. The layout of each paper is in
 * src/components/inquiries/papers.tsx.
 */
import type { InquiryStageKey } from "@/lib/inquiries/stages";

type StageFieldType =
  | "text"
  | "longtext"
  | "date"
  | "time"
  | "amount"
  | "number"
  | "choice"
  | "yesno";

/** A step's own details that are not written on a paper. */
export const STEP_FORM = "form";

export type StageField = {
  key: string;
  label: string;
  type: StageFieldType;
  /** Where it is filled in: a document of the step, or the step's own form. */
  on: string;
  /** Must be filled in before the step can be completed. */
  required?: boolean;
  options?: readonly { value: string; label: string }[];
  /** Takes the full width of the form. */
  wide?: boolean;
  /** Value offered when the step is first opened. */
  prefill?:
    | "today"
    | "grandTotal"
    | "neededBy"
    | "customerName"
    | "customerAddress"
    | string;
};

/**
 * How a step treats the job's items:
 * - entry: listed with quantity and price (the Inquiry)
 * - priced: the same list with units, as quoted (the Quotation)
 * - delivery: how much of each item was delivered
 * - fixed: shown on the step's papers, not changed
 */
type StageItemsMode = "entry" | "priced" | "delivery" | "fixed";

type StageDocument = {
  key: string;
  title: string;
  /** Short code in the document's number, e.g. AJE/QTN/2026/0001. */
  counterKey: string;
  /** The yes/no answer of the step that says this document is needed. */
  enabledBy?: string;
};

type StageTable = {
  /** The document the list is written on. */
  on: string;
  /** What the list and one row of it are called. */
  title: string;
  rowLabel: string;
  columns: readonly { key: string; label: string; numeric?: boolean }[];
};

/** Something a step writes against each item: a remark, a heat number, … */
type ItemDetail = {
  key: string;
  label: string;
  /** The documents of the step it is printed on. */
  on: readonly string[];
};

type StageDefinition = {
  /** One line telling the person what this step is for. */
  purpose: string;
  /** The step's papers. The first one without `enabledBy` is its main one. */
  documents: StageDocument[];
  /** Code of the step's own number, for a step without a main paper. */
  counterKey?: string;
  fields: StageField[];
  items: StageItemsMode;
  itemDetails: readonly ItemDetail[];
  /** Lists the step keeps of its own. */
  tables: Record<string, StageTable>;
};

const JOB_TYPES = [
  { value: "local", label: "Local job (inside the UAE)" },
  { value: "export", label: "Export job (shipped abroad)" },
] as const;

const DEFAULT_VAT_PERCENT = "5";

export const STAGE_DEFINITIONS: Record<InquiryStageKey, StageDefinition> = {
  inquiry: {
    purpose:
      "Record who is asking and what they need. These details fill in every paper that follows.",
    documents: [],
    items: "entry",
    itemDetails: [],
    tables: {},
    fields: [
      {
        key: "title",
        label: "Inquiry title",
        type: "text",
        on: STEP_FORM,
        required: true,
        wide: true,
      },
      {
        key: "customerName",
        label: "Customer / company name",
        type: "text",
        on: STEP_FORM,
        required: true,
      },
      {
        key: "contactPerson",
        label: "Attention (contact person)",
        type: "text",
        on: STEP_FORM,
      },
      {
        key: "contact",
        label: "Contact / WhatsApp",
        type: "text",
        on: STEP_FORM,
        required: true,
      },
      { key: "email", label: "Email address", type: "text", on: STEP_FORM },
      {
        key: "customerTrn",
        label: "Customer TRN (VAT no.)",
        type: "text",
        on: STEP_FORM,
      },
      {
        key: "customerAddress",
        label: "Customer address",
        type: "text",
        on: STEP_FORM,
      },
      {
        key: "jobType",
        label: "Type of job",
        type: "choice",
        on: STEP_FORM,
        options: JOB_TYPES,
        required: true,
        prefill: "local",
      },
      {
        key: "receivedVia",
        label: "Inquiry channel",
        type: "choice",
        on: STEP_FORM,
        options: [
          { value: "walk_in", label: "Walk-in" },
          { value: "phone", label: "Phone call" },
          { value: "email", label: "Email" },
          { value: "whatsapp", label: "WhatsApp" },
          { value: "existing_customer", label: "Existing customer" },
          { value: "referral", label: "Referral" },
        ],
      },
      {
        key: "deliveryExpectedOn",
        label: "Needed by",
        type: "date",
        on: STEP_FORM,
      },
      {
        key: "details",
        label: "What the customer asked for",
        type: "longtext",
        on: STEP_FORM,
        wide: true,
      },
    ],
  },

  quotation: {
    purpose:
      "Prepare the quotation for the customer. Its prices carry through to the job card, delivery note and invoices.",
    documents: [{ key: "quotation", title: "Quotation", counterKey: "QTN" }],
    items: "priced",
    itemDetails: [],
    tables: {},
    fields: [
      {
        key: "quotationDate",
        label: "Quotation Date",
        type: "date",
        on: "quotation",
        required: true,
        prefill: "today",
      },
      { key: "validUntil", label: "Valid Until", type: "date", on: "quotation" },
      { key: "discount", label: "Discount", type: "amount", on: "quotation" },
      {
        key: "vatPercent",
        label: "VAT %",
        type: "number",
        on: "quotation",
        required: true,
        prefill: DEFAULT_VAT_PERCENT,
      },
      {
        key: "termMaterial",
        label: "Material Scope & Standards",
        type: "text",
        on: "quotation",
      },
      {
        key: "termDelivery",
        label: "Delivery Scope & Logistics",
        type: "text",
        on: "quotation",
      },
      {
        key: "termLeadTime",
        label: "Production Lead Time",
        type: "text",
        on: "quotation",
      },
      {
        key: "termPayment",
        label: "Terms of Payment",
        type: "text",
        on: "quotation",
        required: true,
      },
      {
        key: "termValidity",
        label: "Quotation Validity",
        type: "text",
        on: "quotation",
      },
    ],
  },

  lpo_in_or_out: {
    purpose:
      "Record the customer's purchase order (LPO in). If material has to be bought for this job, prepare our purchase order to the supplier (LPO out).",
    documents: [
      {
        key: "purchase_order",
        title: "Purchase Order",
        counterKey: "PO",
        enabledBy: "supplierOrderNeeded",
      },
    ],
    counterKey: "LPO",
    items: "fixed",
    itemDetails: [],
    tables: {
      poLines: {
        on: "purchase_order",
        title: "What is being ordered",
        rowLabel: "Line",
        columns: [
          { key: "description", label: "Item & Description" },
          { key: "quantity", label: "QTY" },
          { key: "rate", label: "RATE", numeric: true },
        ],
      },
    },
    fields: [
      {
        key: "customerLpoNumber",
        label: "Customer LPO number",
        type: "text",
        on: STEP_FORM,
        required: true,
      },
      {
        key: "customerLpoDate",
        label: "LPO date",
        type: "date",
        on: STEP_FORM,
        required: true,
      },
      {
        key: "customerLpoAmount",
        label: "LPO amount (AED)",
        type: "amount",
        on: STEP_FORM,
        prefill: "grandTotal",
      },
      {
        key: "customerLpoNotes",
        label: "Anything different from the quotation",
        type: "longtext",
        on: STEP_FORM,
        wide: true,
      },
      {
        key: "supplierOrderNeeded",
        label:
          "LPO out: material has to be ordered from a supplier for this job",
        type: "yesno",
        on: STEP_FORM,
        wide: true,
      },
      {
        key: "poDate",
        label: "Dated",
        type: "date",
        on: "purchase_order",
        prefill: "today",
      },
      {
        key: "supplierName",
        label: "Supplier (consignee)",
        type: "text",
        on: "purchase_order",
        required: true,
      },
      { key: "supplierPhone", label: "PH", type: "text", on: "purchase_order" },
      {
        key: "supplierEmirate",
        label: "Emirate",
        type: "text",
        on: "purchase_order",
      },
      { key: "supplierTrn", label: "TRN", type: "text", on: "purchase_order" },
      {
        key: "poPaymentMode",
        label: "Mode/Terms of Payment",
        type: "text",
        on: "purchase_order",
      },
      {
        key: "poOtherReference",
        label: "Other Reference(s)",
        type: "text",
        on: "purchase_order",
      },
      {
        key: "poSupplierRef",
        label: "Supplier's Ref./Order No.",
        type: "text",
        on: "purchase_order",
      },
      {
        key: "poDespatch",
        label: "Despatch through",
        type: "text",
        on: "purchase_order",
      },
      {
        key: "poDestination",
        label: "Destination",
        type: "text",
        on: "purchase_order",
      },
      {
        key: "poDeliveryTerms",
        label: "Terms of Delivery",
        type: "text",
        on: "purchase_order",
      },
      {
        key: "poTerms",
        label: "Terms and conditions",
        type: "longtext",
        on: "purchase_order",
      },
    ],
  },

  proforma_invoice: {
    purpose:
      "Ask for the advance payment before work starts. Leave the advance empty if this job has none.",
    documents: [
      { key: "proforma_invoice", title: "Proforma Invoice", counterKey: "PI" },
    ],
    items: "fixed",
    itemDetails: [],
    tables: {},
    fields: [
      {
        key: "proformaDate",
        label: "Proforma Date",
        type: "date",
        on: "proforma_invoice",
        required: true,
        prefill: "today",
      },
      {
        key: "paymentTerms",
        label: "Payment Terms",
        type: "text",
        on: "proforma_invoice",
      },
      { key: "dueDate", label: "Due Date", type: "date", on: "proforma_invoice" },
      {
        key: "advancePercent",
        label: "Advance %",
        type: "number",
        on: "proforma_invoice",
      },
      {
        key: "advanceAmount",
        label: "Advance amount",
        type: "amount",
        on: "proforma_invoice",
      },
    ],
  },

  job_card: {
    purpose:
      "Hand the job to the workshop. The compliance and coating certificates are prepared here when the job needs them.",
    documents: [
      { key: "job_card", title: "Job Card", counterKey: "JC" },
      {
        key: "compliance_certificate",
        title: "Certificate of Compliance",
        counterKey: "COC",
        enabledBy: "complianceCertificate",
      },
      {
        key: "coating_certificate",
        title: "Coating Certificate",
        counterKey: "CC",
        enabledBy: "coatingCertificate",
      },
    ],
    items: "fixed",
    itemDetails: [
      { key: "jobRemark", label: "Remark", on: ["job_card"] },
      {
        key: "heatNo",
        label: "Heat No.",
        on: ["compliance_certificate", "coating_certificate"],
      },
      { key: "origin", label: "Origin", on: ["compliance_certificate"] },
      {
        key: "complianceRemark",
        label: "Remarks",
        on: ["compliance_certificate"],
      },
    ],
    tables: {},
    fields: [
      {
        key: "complianceCertificate",
        label: "This job needs a Certificate of Compliance",
        type: "yesno",
        on: STEP_FORM,
      },
      {
        key: "coatingCertificate",
        label: "This job needs a Coating Certificate",
        type: "yesno",
        on: STEP_FORM,
      },
      {
        key: "expectedDelivery",
        label: "Expected Delivery",
        type: "date",
        on: "job_card",
        required: true,
        prefill: "neededBy",
      },
      {
        key: "technician1",
        label: "Assigned Technician",
        type: "text",
        on: "job_card",
      },
      {
        key: "technician2",
        label: "Assigned Technician (second)",
        type: "text",
        on: "job_card",
      },
      {
        key: "supervisor",
        label: "Workshop Supervisor",
        type: "text",
        on: "job_card",
        required: true,
      },
      { key: "startDate", label: "Start Date", type: "date", on: "job_card" },
      { key: "startTime", label: "Start Time", type: "time", on: "job_card" },
      { key: "endDate", label: "End Date", type: "date", on: "job_card" },
      { key: "endTime", label: "End Time", type: "time", on: "job_card" },
      {
        key: "technicianHours",
        label: "Total Technician Hours",
        type: "number",
        on: "job_card",
      },
      {
        key: "overtimeHours",
        label: "Total Overtime Hours",
        type: "number",
        on: "job_card",
      },
      {
        key: "technicianRemarks",
        label: "Technician remarks",
        type: "longtext",
        on: "job_card",
      },
      {
        key: "complianceIssueDate",
        label: "Issue Date",
        type: "date",
        on: "compliance_certificate",
        prefill: "today",
      },
      {
        key: "coatingIssueDate",
        label: "Date of Issue",
        type: "date",
        on: "coating_certificate",
        prefill: "today",
      },
      {
        key: "coatingStandard",
        label: "Coating Standard",
        type: "text",
        on: "coating_certificate",
        prefill:
          "ASTM B 633 (Electrodeposited Coatings of Zinc on Iron and Steel)",
      },
      {
        key: "coatingRawMaterial",
        label: "Raw Material Used",
        type: "text",
        on: "coating_certificate",
        prefill: "Zinc High Grade (99.99% Purity - SHG)",
      },
      {
        key: "coatingPassivation",
        label: "Passivation Process",
        type: "text",
        on: "coating_certificate",
        prefill: "YES (Clear Blue Bright Passivation)",
      },
      {
        key: "coatingChemicalManufacturer",
        label: "Chemical Manufacturer",
        type: "text",
        on: "coating_certificate",
      },
      {
        key: "coatingChemicalControl",
        label: "Chemical Control",
        type: "text",
        on: "coating_certificate",
        prefill: "Regular Analysis of Chemistries",
      },
      {
        key: "appearanceResult",
        label: "Appearance result",
        type: "text",
        on: "coating_certificate",
        prefill: "YES",
      },
      {
        key: "adhesionResult",
        label: "Adhesion test result",
        type: "text",
        on: "coating_certificate",
        prefill: "YES",
      },
      {
        key: "thicknessReadings",
        label: "Coating thickness readings",
        type: "text",
        on: "coating_certificate",
      },
      {
        key: "thicknessResult",
        label: "Coating thickness result",
        type: "text",
        on: "coating_certificate",
        prefill: "PASSED",
      },
    ],
  },

  progress_invoice: {
    purpose:
      "Bill for the work done so far, when the job is billed in parts. Say how far the work has got.",
    documents: [
      { key: "progress_invoice", title: "Progress Invoice", counterKey: "PRG" },
    ],
    items: "fixed",
    itemDetails: [],
    tables: {},
    fields: [
      {
        key: "invoiceDate",
        label: "Invoice Date",
        type: "date",
        on: "progress_invoice",
        required: true,
        prefill: "today",
      },
      {
        key: "paymentTerms",
        label: "Payment Terms",
        type: "text",
        on: "progress_invoice",
      },
      { key: "dueDate", label: "Due Date", type: "date", on: "progress_invoice" },
      {
        key: "progressPercent",
        label: "Work completed %",
        type: "number",
        on: "progress_invoice",
        required: true,
      },
      {
        key: "amount",
        label: "Amount billed now",
        type: "amount",
        on: "progress_invoice",
      },
    ],
  },

  delivery_note: {
    purpose:
      "Prepare the delivery note that goes with the goods. Write the delivered quantity of each item; the customer signs the printed copy.",
    documents: [
      { key: "delivery_note", title: "Delivery Note", counterKey: "DN" },
    ],
    items: "delivery",
    itemDetails: [
      { key: "deliveryRemark", label: "Remarks / Status", on: ["delivery_note"] },
    ],
    tables: {},
    fields: [
      {
        key: "deliveryDate",
        label: "Date",
        type: "date",
        on: "delivery_note",
        required: true,
        prefill: "today",
      },
      {
        key: "deliveryAddress",
        label: "Delivery address",
        type: "text",
        on: "delivery_note",
        prefill: "customerAddress",
      },
    ],
  },

  tax_invoice: {
    purpose:
      "Bill the customer for the job. The quotation, LPO, delivery note and job card numbers are filled in for you.",
    documents: [{ key: "tax_invoice", title: "Tax Invoice", counterKey: "INV" }],
    items: "fixed",
    itemDetails: [],
    tables: {},
    fields: [
      {
        key: "invoiceDate",
        label: "Invoice Date",
        type: "date",
        on: "tax_invoice",
        required: true,
        prefill: "today",
      },
      {
        key: "paymentTerms",
        label: "Payment Terms",
        type: "text",
        on: "tax_invoice",
        required: true,
      },
      { key: "dueDate", label: "Due Date", type: "date", on: "tax_invoice" },
      {
        key: "creditLimit",
        label: "Approved Credit Limit",
        type: "amount",
        on: "tax_invoice",
      },
      {
        key: "previousOutstanding",
        label: "Previous Outstanding Balance",
        type: "amount",
        on: "tax_invoice",
      },
    ],
  },

  commercial_invoice: {
    purpose:
      "For goods sent overseas: the commercial invoice, and the packing list when one is needed.",
    documents: [
      {
        key: "commercial_invoice",
        title: "Commercial Invoice",
        counterKey: "CI",
      },
      {
        key: "packing_list",
        title: "Packing List",
        counterKey: "PL",
        enabledBy: "packingList",
      },
    ],
    items: "fixed",
    itemDetails: [
      {
        key: "hsCode",
        label: "HS Code",
        on: ["commercial_invoice", "packing_list"],
      },
      {
        key: "heatNo",
        label: "Heat #",
        on: ["commercial_invoice", "packing_list"],
      },
      {
        key: "origin",
        label: "Origin",
        on: ["commercial_invoice", "packing_list"],
      },
      { key: "packNo", label: "Pack No.", on: ["packing_list"] },
    ],
    tables: {
      packages: {
        on: "packing_list",
        title: "Packages",
        rowLabel: "Package",
        columns: [
          { key: "mark", label: "Mark / Pkg No." },
          { key: "packageType", label: "Package Type" },
          { key: "grossWeight", label: "Gross Wt." },
          { key: "dimensions", label: "Dimensions (LxWxH)" },
        ],
      },
    },
    fields: [
      {
        key: "packingList",
        label: "This shipment needs a Packing List",
        type: "yesno",
        on: STEP_FORM,
      },
      {
        key: "ciDate",
        label: "Date",
        type: "date",
        on: "commercial_invoice",
        required: true,
        prefill: "today",
      },
      {
        key: "ciPaymentTerms",
        label: "Payment Terms",
        type: "text",
        on: "commercial_invoice",
      },
      {
        key: "dispatchDate",
        label: "Dispatch Date",
        type: "date",
        on: "packing_list",
        prefill: "today",
      },
      {
        key: "deliverySiteAddress",
        label: "Delivery Site Address",
        type: "text",
        on: "packing_list",
      },
      {
        key: "siteContactPerson",
        label: "Site Contact Person",
        type: "text",
        on: "packing_list",
      },
      {
        key: "siteContact",
        label: "Contact / WhatsApp",
        type: "text",
        on: "packing_list",
      },
      {
        key: "finalDestination",
        label: "Final Destination",
        type: "text",
        on: "packing_list",
      },
      {
        key: "carrier",
        label: "Carrier / Freight Co",
        type: "text",
        on: "packing_list",
      },
      {
        key: "vehicleNumber",
        label: "Vehicle / Container No",
        type: "text",
        on: "packing_list",
      },
      {
        key: "portOfLoading",
        label: "Port of Loading / Origin",
        type: "text",
        on: "packing_list",
      },
      {
        key: "totalGrossWeight",
        label: "Total Gross Weight (KG)",
        type: "number",
        on: "packing_list",
      },
    ],
  },

  receipt_voucher: {
    purpose: "Record the customer's payment. This closes the job.",
    documents: [
      { key: "receipt_voucher", title: "Receipt Voucher", counterKey: "RV" },
    ],
    items: "fixed",
    itemDetails: [],
    tables: {},
    fields: [
      {
        key: "receiptDate",
        label: "Date",
        type: "date",
        on: "receipt_voucher",
        required: true,
        prefill: "today",
      },
      {
        key: "receivedFrom",
        label: "Received from",
        type: "text",
        on: "receipt_voucher",
        prefill: "customerName",
      },
      {
        key: "amountReceived",
        label: "Amount received",
        type: "amount",
        on: "receipt_voucher",
        required: true,
        prefill: "grandTotal",
      },
      {
        key: "paymentMethod",
        label: "Paid by",
        type: "choice",
        on: "receipt_voucher",
        required: true,
        options: [
          { value: "cash", label: "Cash" },
          { value: "cheque", label: "Cheque" },
          { value: "bank_transfer", label: "Bank transfer" },
          { value: "card", label: "Card" },
        ],
      },
      {
        key: "reference",
        label: "Cheque / transfer reference",
        type: "text",
        on: "receipt_voucher",
      },
      { key: "bank", label: "Bank", type: "text", on: "receipt_voucher" },
      {
        key: "remarks",
        label: "Being payment for",
        type: "text",
        on: "receipt_voucher",
      },
    ],
  },
};

/* -------------------------------- documents ------------------------------- */

/** The step's main document: the one it always produces. */
export function mainDocument(stage: InquiryStageKey): StageDocument | null {
  return (
    STAGE_DEFINITIONS[stage].documents.find((doc) => !doc.enabledBy) ?? null
  );
}

/**
 * The code of the number a step gets as soon as the job reaches it: its main
 * paper's, or the step's own where it has no main paper.
 */
export function stageCounterKey(stage: InquiryStageKey): string | null {
  return (
    mainDocument(stage)?.counterKey ?? STAGE_DEFINITIONS[stage].counterKey ?? null
  );
}

/** The papers a step has, given its answers: optional ones only if asked for. */
export function documentsInUse(
  stage: InquiryStageKey,
  fields: Record<string, string>,
): StageDocument[] {
  return STAGE_DEFINITIONS[stage].documents.filter(
    (doc) => !doc.enabledBy || fields[doc.enabledBy] === "yes",
  );
}

/**
 * The questions that still have to be answered before the step can be
 * completed. Questions on an optional document only count while that
 * document is in use.
 */
export function missingStageFields(
  stage: InquiryStageKey,
  fields: Record<string, string>,
): StageField[] {
  const inUse = new Set([
    STEP_FORM,
    ...documentsInUse(stage, fields).map((doc) => doc.key),
  ]);
  return STAGE_DEFINITIONS[stage].fields.filter(
    (field) => field.required && inUse.has(field.on) && !fields[field.key],
  );
}

/* ---------------------------------- money --------------------------------- */

export type InquiryTotals = {
  subtotal: number;
  discount: number;
  vatPercent: number;
  vat: number;
  total: number;
};

const toNumber = (value: string | undefined) => Number(value) || 0;
const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * What the job is worth: the priced items, less the discount, plus VAT.
 * The discount and VAT rate are the ones entered on the quotation.
 */
export function inquiryTotals(
  items: readonly { quantity: string; unitPrice: string }[],
  quotation: Record<string, string> = {},
): InquiryTotals {
  const subtotal = round2(
    items.reduce(
      (sum, item) => sum + toNumber(item.quantity) * toNumber(item.unitPrice),
      0,
    ),
  );
  const discount = Math.min(round2(toNumber(quotation.discount)), subtotal);
  const vatPercent =
    quotation.vatPercent === undefined || quotation.vatPercent === ""
      ? Number(DEFAULT_VAT_PERCENT)
      : toNumber(quotation.vatPercent);
  const vat = round2(((subtotal - discount) * vatPercent) / 100);
  return {
    subtotal,
    discount,
    vatPercent,
    vat,
    total: round2(subtotal - discount + vat),
  };
}

export function formatMoney(value: number): string {
  return value.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** The label of a chosen option, or the stored value if it is not listed. */
export function stageFieldDisplay(field: StageField, value: string): string {
  if (field.type === "choice") {
    return field.options?.find((option) => option.value === value)?.label ?? value;
  }
  if (field.type === "yesno") return value === "yes" ? "Yes" : "No";
  return value;
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function wordsBelowThousand(value: number): string {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest >= 20) {
    parts.push([TENS[Math.floor(rest / 10)], ONES[rest % 10]].filter(Boolean).join(" "));
  } else if (rest > 0) {
    parts.push(ONES[rest]!);
  }
  return parts.join(" ");
}

function wholeNumberInWords(value: number): string {
  if (value === 0) return "Zero";
  const groups = ["", " Thousand", " Million", " Billion"];
  const parts: string[] = [];
  let rest = value;
  for (const group of groups) {
    const chunk = rest % 1000;
    if (chunk) parts.unshift(`${wordsBelowThousand(chunk)}${group}`);
    rest = Math.floor(rest / 1000);
  }
  return parts.join(" ");
}

/** An amount as written on invoices: "Six Thousand Three Hundred UAE Dirhams Only". */
export function amountInWords(amount: number): string {
  const fils = Math.round(amount * 100);
  const dirhams = Math.floor(fils / 100);
  const remainder = fils % 100;
  return `${wholeNumberInWords(dirhams)} UAE Dirhams${
    remainder ? ` and ${wholeNumberInWords(remainder)} Fils` : ""
  } Only`;
}
