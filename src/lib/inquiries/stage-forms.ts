/**
 * What each step of the inquiry process asks for.
 *
 * An inquiry is one job, from the first request to the money being received.
 * Every step has its own form, described here: its questions, what it does
 * with the list of items, and the number its document gets. Saving, moving
 * on, approvals and the screens are the same for all steps, so changing what
 * a step asks is a change to this file only.
 */
import type { InquiryStageKey } from "@/lib/inquiries/stages";

type StageFieldType =
  | "text"
  | "longtext"
  | "date"
  | "amount"
  | "number"
  | "choice"
  | "yesno";

export type StageField = {
  key: string;
  label: string;
  type: StageFieldType;
  /** Must be filled in before the step can be completed. */
  required?: boolean;
  options?: readonly { value: string; label: string }[];
  /** Heading this field sits under, for steps with more than one part. */
  group?: string;
  /** Takes the full width of the form. */
  wide?: boolean;
  /** Value offered when the step is first opened. */
  prefill?: "today" | "grandTotal" | string;
};

/**
 * How a step treats the job's items:
 * - scope: what the customer wants (description, quantity, unit)
 * - priced: the same list with prices
 * - delivery: how much of each item was delivered
 * - summary: shown for reference, not changed
 * - none: not shown
 */
export type StageItemsMode =
  | "scope"
  | "priced"
  | "delivery"
  | "summary"
  | "none";

type StageDefinition = {
  /** One line telling the person what this step is for. */
  purpose: string;
  /** Short code in this step's document number, e.g. AJE/QTN/2026/0001. */
  counterKey: string | null;
  /** What that number is called. */
  documentLabel: string;
  fields: StageField[];
  items: StageItemsMode;
};

/** Inquiry-step answers that are kept on the inquiry itself. */
export const INQUIRY_HEADER_FIELDS = [
  "customerName",
  "contact",
  "title",
  "jobType",
  "deliveryExpectedOn",
  "details",
] as const;

const JOB_TYPES = [
  { value: "local", label: "Local job (inside the UAE)" },
  { value: "export", label: "Export job (shipped abroad)" },
] as const;

const DEFAULT_VAT_PERCENT = "5";

export const STAGE_DEFINITIONS: Record<InquiryStageKey, StageDefinition> = {
  inquiry: {
    purpose:
      "Record who is asking and what they need, so a quotation can be prepared.",
    counterKey: "INQ",
    documentLabel: "Inquiry No.",
    items: "scope",
    fields: [
      {
        key: "customerName",
        label: "Customer / company name",
        type: "text",
        required: true,
      },
      { key: "contactPerson", label: "Contact person", type: "text" },
      { key: "contact", label: "Phone", type: "text", required: true },
      { key: "email", label: "Email", type: "text" },
      {
        key: "title",
        label: "Inquiry title (the job in a few words)",
        type: "text",
        required: true,
        wide: true,
      },
      {
        key: "jobType",
        label: "Type of job",
        type: "choice",
        options: JOB_TYPES,
        required: true,
        prefill: "local",
      },
      {
        key: "receivedVia",
        label: "How it came in",
        type: "choice",
        options: [
          { value: "walk_in", label: "Walk-in" },
          { value: "phone", label: "Phone call" },
          { value: "email", label: "Email" },
          { value: "whatsapp", label: "WhatsApp" },
          { value: "existing_customer", label: "Existing customer" },
          { value: "referral", label: "Referral" },
        ],
      },
      { key: "deliveryExpectedOn", label: "Needed by", type: "date" },
      { key: "siteLocation", label: "Site / delivery location", type: "text" },
      {
        key: "details",
        label: "What the customer asked for",
        type: "longtext",
        wide: true,
      },
    ],
  },

  quotation: {
    purpose:
      "Price the job and send the customer a quotation. The prices set here carry through to the invoices.",
    counterKey: "QTN",
    documentLabel: "Quotation No.",
    items: "priced",
    fields: [
      {
        key: "quotationDate",
        label: "Quotation date",
        type: "date",
        required: true,
        prefill: "today",
      },
      { key: "validUntil", label: "Valid until", type: "date" },
      { key: "attention", label: "Attention (person)", type: "text" },
      { key: "subject", label: "Subject", type: "text" },
      { key: "discount", label: "Discount (AED)", type: "amount" },
      {
        key: "vatPercent",
        label: "VAT %",
        type: "number",
        required: true,
        prefill: DEFAULT_VAT_PERCENT,
      },
      {
        key: "paymentTerms",
        label: "Payment terms",
        type: "text",
        required: true,
      },
      { key: "deliveryPeriod", label: "Delivery period", type: "text" },
      {
        key: "remarks",
        label: "Notes printed on the quotation",
        type: "longtext",
        wide: true,
      },
    ],
  },

  lpo_in_or_out: {
    purpose:
      "Record the customer's purchase order (LPO in). If material must be bought for this job, record our order to the supplier (LPO out).",
    counterKey: null,
    documentLabel: "Customer LPO No.",
    items: "summary",
    fields: [
      {
        key: "customerLpoNumber",
        label: "Customer LPO number",
        type: "text",
        required: true,
        group: "LPO in · from the customer",
      },
      {
        key: "customerLpoDate",
        label: "LPO date",
        type: "date",
        required: true,
        group: "LPO in · from the customer",
      },
      {
        key: "customerLpoAmount",
        label: "LPO amount (AED)",
        type: "amount",
        prefill: "grandTotal",
        group: "LPO in · from the customer",
      },
      {
        key: "customerLpoNotes",
        label: "Anything different from the quotation",
        type: "longtext",
        wide: true,
        group: "LPO in · from the customer",
      },
      {
        key: "supplierOrderNeeded",
        label: "Material has to be ordered from a supplier for this job",
        type: "yesno",
        wide: true,
        group: "LPO out · to a supplier",
      },
      {
        key: "supplierName",
        label: "Supplier",
        type: "text",
        group: "LPO out · to a supplier",
      },
      {
        key: "supplierLpoNumber",
        label: "Our LPO number",
        type: "text",
        group: "LPO out · to a supplier",
      },
      {
        key: "supplierLpoDate",
        label: "Our LPO date",
        type: "date",
        group: "LPO out · to a supplier",
      },
      {
        key: "supplierLpoAmount",
        label: "Our LPO amount (AED)",
        type: "amount",
        group: "LPO out · to a supplier",
      },
    ],
  },

  proforma_invoice: {
    purpose:
      "Ask for the advance payment before work starts. Skip the amounts if this job has no advance.",
    counterKey: "PI",
    documentLabel: "Proforma No.",
    items: "summary",
    fields: [
      {
        key: "proformaDate",
        label: "Proforma date",
        type: "date",
        required: true,
        prefill: "today",
      },
      { key: "advancePercent", label: "Advance %", type: "number" },
      { key: "advanceAmount", label: "Advance amount (AED)", type: "amount" },
      { key: "advanceDueOn", label: "Advance due by", type: "date" },
      {
        key: "advanceReceived",
        label: "The advance has been received",
        type: "yesno",
        wide: true,
      },
      { key: "remarks", label: "Notes", type: "longtext", wide: true },
    ],
  },

  job_card: {
    purpose:
      "Hand the job to the workshop: who does it, what to do and by when.",
    counterKey: "JC",
    documentLabel: "Job Card No.",
    items: "summary",
    fields: [
      {
        key: "startDate",
        label: "Work starts",
        type: "date",
        required: true,
        prefill: "today",
      },
      { key: "targetDate", label: "Target completion", type: "date" },
      {
        key: "supervisor",
        label: "Workshop supervisor",
        type: "text",
        required: true,
      },
      {
        key: "technicians",
        label: "Assigned technicians",
        type: "text",
      },
      {
        key: "instructions",
        label: "Work instructions",
        type: "longtext",
        wide: true,
        required: true,
      },
      {
        key: "materials",
        label: "Materials needed",
        type: "longtext",
        wide: true,
      },
      {
        key: "complianceCertificate",
        label: "Certificate of Compliance needed",
        type: "yesno",
      },
      {
        key: "coatingCertificate",
        label: "Coating Certificate needed",
        type: "yesno",
      },
      { key: "completedOn", label: "Work completed on", type: "date" },
    ],
  },

  progress_invoice: {
    purpose:
      "Report how far the work has got and bill for it, if this job is billed in parts.",
    counterKey: "PRG",
    documentLabel: "Progress Invoice No.",
    items: "summary",
    fields: [
      {
        key: "invoiceDate",
        label: "Date",
        type: "date",
        required: true,
        prefill: "today",
      },
      {
        key: "progressPercent",
        label: "Work completed %",
        type: "number",
        required: true,
      },
      { key: "amount", label: "Amount billed now (AED)", type: "amount" },
      {
        key: "remarks",
        label: "Progress update",
        type: "longtext",
        wide: true,
      },
    ],
  },

  delivery_note: {
    purpose:
      "Record what was delivered and who received it. Enter the delivered quantity for each item.",
    counterKey: "DN",
    documentLabel: "Delivery Note No.",
    items: "delivery",
    fields: [
      {
        key: "deliveryDate",
        label: "Delivery date",
        type: "date",
        required: true,
        prefill: "today",
      },
      { key: "deliveredTo", label: "Delivered to (address)", type: "text" },
      { key: "vehicleNumber", label: "Vehicle number", type: "text" },
      { key: "driverName", label: "Driver", type: "text" },
      {
        key: "receivedBy",
        label: "Received by (customer's person)",
        type: "text",
        required: true,
      },
      { key: "receiverPhone", label: "Receiver's phone", type: "text" },
      { key: "remarks", label: "Remarks", type: "longtext", wide: true },
    ],
  },

  tax_invoice: {
    purpose:
      "Bill the customer for the job. Quotation, LPO, job card and delivery note numbers are picked up automatically.",
    counterKey: "INV",
    documentLabel: "Tax Invoice No.",
    items: "summary",
    fields: [
      {
        key: "invoiceDate",
        label: "Invoice date",
        type: "date",
        required: true,
        prefill: "today",
      },
      { key: "dueDate", label: "Payment due by", type: "date" },
      { key: "customerTrn", label: "Customer TRN", type: "text" },
      { key: "paymentTerms", label: "Payment terms", type: "text" },
      {
        key: "billingAddress",
        label: "Customer billing address",
        type: "longtext",
        wide: true,
      },
      { key: "remarks", label: "Notes", type: "longtext", wide: true },
    ],
  },

  receipt_voucher: {
    purpose: "Record the customer's payment. This closes the job.",
    counterKey: "RV",
    documentLabel: "Receipt Voucher No.",
    items: "none",
    fields: [
      {
        key: "receiptDate",
        label: "Received on",
        type: "date",
        required: true,
        prefill: "today",
      },
      {
        key: "amountReceived",
        label: "Amount received (AED)",
        type: "amount",
        required: true,
        prefill: "grandTotal",
      },
      {
        key: "paymentMethod",
        label: "Paid by",
        type: "choice",
        required: true,
        options: [
          { value: "cash", label: "Cash" },
          { value: "cheque", label: "Cheque" },
          { value: "bank_transfer", label: "Bank transfer" },
          { value: "card", label: "Card" },
        ],
      },
      { key: "reference", label: "Cheque / transfer reference", type: "text" },
      { key: "bank", label: "Bank", type: "text" },
      { key: "receivedFrom", label: "Received from", type: "text" },
      { key: "remarks", label: "Notes", type: "longtext", wide: true },
    ],
  },
};

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
