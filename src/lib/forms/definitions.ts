/**
 * The company's internal forms that are filled in and signed off.
 *
 * Each one is described here: what is asked, the lines it lists, where it
 * is raised and how its amount is worked out. Entering, saving, signing and
 * printing are the same for all of them; who signs is in
 * src/lib/signoffs/chains.ts.
 */
import { formatFormDate } from "@/lib/datetime/format";
import type { InquiryWorkflowDepartmentKey } from "@/lib/inquiries/stages";

export const FORM_TYPES = [
  "fine_notice",
  "medical_claim",
  "petty_cash",
  "material_request",
  "verbal_work_approval",
  "overtime",
] as const;

export type FormType = (typeof FORM_TYPES)[number];

export function isFormType(value: string): value is FormType {
  return (FORM_TYPES as readonly string[]).includes(value);
}

export type FormField = {
  key: string;
  label: string;
  /** "employee" is one of the company's people, chosen from a list. */
  type:
    | "text"
    | "longtext"
    | "date"
    | "time"
    | "amount"
    | "number"
    | "employee";
  required?: boolean;
  defaultValue?: string;
};

/** What was typed into a form: its fields and its lines, by field key. */
export type FormAnswers = {
  fields: Record<string, string>;
  lines: Record<string, string>[];
};

export type FormDefinition = {
  /** Printed title. */
  title: string;
  /** Name of the list and of one form, as shown in the app. */
  listLabel: string;
  itemLabel: string;
  /** Short code in the reference number: FN/2026/0001. */
  counterKey: string;
  /** Reception, or the department workspace it is raised from. */
  raisedIn: "reception" | InquiryWorkflowDepartmentKey;
  /** The form concerns one employee, who is chosen when raising it. */
  aboutEmployee: boolean;
  fields: FormField[];
  /** Columns of its lines; empty if the form has none. */
  lineColumns: FormField[];
  /** Headline amount in AED, for forms that have one. */
  amount: (answers: FormAnswers) => number | null;
  /** One line saying what a form of this kind is, for lists. */
  summary?: (answers: FormAnswers) => string;
  /** Said under the lines while the form is being filled in. */
  linesNote?: string;
};

export const VAT_RATE = 0.05;
/** Share of a medical bill the company pays; the employee pays the rest. */
export const MEDICAL_COMPANY_SHARE = 0.7;

const number = (value: string | undefined) => Number(value) || 0;
const sum = (lines: Record<string, string>[], key: string) =>
  lines.reduce((total, line) => total + number(line[key]), 0);

export const FORM_DEFINITIONS: Record<FormType, FormDefinition> = {
  fine_notice: {
    title: "Fine Notice",
    listLabel: "Fine notices",
    itemLabel: "fine notice",
    counterKey: "FN",
    raisedIn: "reception",
    aboutEmployee: true,
    fields: [
      {
        key: "reason",
        label:
          "What happened (continues “it is noticed from the office that you have…”)",
        type: "longtext",
        required: true,
      },
      { key: "amount", label: "Fine (AED)", type: "amount", required: true },
    ],
    lineColumns: [],
    amount: ({ fields }) => number(fields.amount),
  },
  medical_claim: {
    title: "Medical Amount",
    listLabel: "Medical amounts",
    itemLabel: "medical amount",
    counterKey: "MED",
    raisedIn: "reception",
    aboutEmployee: true,
    fields: [
      { key: "date", label: "Date", type: "date", required: true },
      {
        key: "hospital",
        label: "Hospital / pharmacy name",
        type: "text",
        required: true,
      },
      {
        key: "total",
        label: "Total amount (AED)",
        type: "amount",
        required: true,
      },
    ],
    lineColumns: [],
    amount: ({ fields }) => number(fields.total),
  },
  petty_cash: {
    title: "Petty Cash Form ( Daily Purchase )",
    listLabel: "Petty cash",
    itemLabel: "petty cash form",
    counterKey: "PC",
    raisedIn: "accounts",
    aboutEmployee: false,
    fields: [
      {
        key: "projectName",
        label: "Project name",
        type: "text",
        required: true,
        defaultValue: "GENERAL PETTY CASH",
      },
      { key: "projectCode", label: "Project code", type: "text" },
      { key: "description", label: "Description of the work", type: "text" },
      {
        key: "requestDate",
        label: "Request date",
        type: "date",
        required: true,
      },
    ],
    lineColumns: [
      {
        key: "receivedAmount",
        label: "Received amount (credit)",
        type: "amount",
      },
      { key: "vehicleNo", label: "Vehicle no", type: "text" },
      { key: "paidBy", label: "Paid by", type: "text" },
      { key: "foodFor", label: "Food for", type: "text" },
      {
        key: "description",
        label: "Petty cash description",
        type: "text",
        required: true,
      },
      { key: "invoiceQty", label: "Qty of invoices", type: "number" },
      {
        key: "invoiceAmount",
        label: "Invoices amount (debit)",
        type: "amount",
        required: true,
      },
    ],
    amount: ({ lines }) => sum(lines, "invoiceAmount"),
  },
  material_request: {
    title: "Material Request Approval Form",
    listLabel: "Material requests",
    itemLabel: "material request",
    counterKey: "MRAF",
    raisedIn: "engineering",
    aboutEmployee: false,
    fields: [
      {
        key: "projectName",
        label: "Project name",
        type: "text",
        required: true,
      },
      { key: "projectCode", label: "Project code", type: "text" },
      {
        key: "section",
        label: "Material request from the section",
        type: "text",
      },
      { key: "description", label: "Description of the work", type: "text" },
      {
        key: "requestDate",
        label: "Request date",
        type: "date",
        required: true,
      },
      { key: "jobNo", label: "Job no", type: "text" },
      { key: "invoiceNo", label: "Invoice no", type: "text" },
    ],
    lineColumns: [
      {
        key: "materialDescription",
        label: "Material description",
        type: "text",
        required: true,
      },
      { key: "qty", label: "Qty", type: "number", required: true },
      { key: "approvalStatus", label: "Approval status", type: "text" },
      { key: "specification", label: "Specification", type: "text" },
      { key: "sample", label: "Sample", type: "text" },
      { key: "sampleNo", label: "Sample no.", type: "text" },
    ],
    amount: () => null,
  },
  verbal_work_approval: {
    title: "Verbal Work Approval Form",
    listLabel: "Verbal work approvals",
    itemLabel: "verbal work approval",
    counterKey: "VWAF",
    raisedIn: "admin",
    aboutEmployee: false,
    fields: [
      {
        key: "projectName",
        label: "Project name",
        type: "text",
        required: true,
      },
      {
        key: "requestedBy",
        label: "Verbally work request by",
        type: "text",
        required: true,
      },
      { key: "description", label: "Description of the work", type: "text" },
      {
        key: "customerName",
        label: "Customer name",
        type: "text",
        required: true,
      },
      { key: "jobCardNumber", label: "Job card number", type: "text" },
      {
        key: "requestDate",
        label: "Request date",
        type: "date",
        required: true,
      },
      { key: "jobNo", label: "Job no", type: "text" },
      {
        key: "deliveryNoteNumber",
        label: "Delivery note number",
        type: "text",
      },
      { key: "deliveryDate", label: "Delivery date", type: "date" },
      { key: "amountCollectedBy", label: "Amount collected by", type: "text" },
    ],
    lineColumns: [
      { key: "approvedBy", label: "Approved by", type: "text" },
      {
        key: "materialDescription",
        label: "Material description",
        type: "text",
        required: true,
      },
      { key: "qty", label: "Qty", type: "number", required: true },
      { key: "jobPrice", label: "Job price", type: "amount", required: true },
      { key: "sampleNo", label: "Sample no. / remarks", type: "text" },
    ],
    amount: ({ lines }) =>
      lines.reduce(
        (total, line) =>
          total + number(line.qty) * number(line.jobPrice) * (1 + VAT_RATE),
        0,
      ),
  },
  overtime: {
    title: "Over Time Payment Details",
    listLabel: "Overtime",
    itemLabel: "overtime sheet",
    counterKey: "OT",
    raisedIn: "reception",
    aboutEmployee: false,
    fields: [
      {
        key: "date",
        label: "Day the overtime was worked",
        type: "date",
        required: true,
      },
      { key: "food", label: "Food (AED)", type: "amount" },
    ],
    lineColumns: [
      { key: "staffId", label: "Employee", type: "employee", required: true },
      { key: "startTime", label: "Start time", type: "time" },
      { key: "endTime", label: "End time", type: "time" },
      {
        key: "hours",
        label: "Overtime (hours)",
        type: "number",
        required: true,
      },
      { key: "jobProgress", label: "Job progress", type: "text" },
      { key: "clientName", label: "Client name", type: "text" },
    ],
    // What each person is paid is added to the lines when the sheet is
    // filed (src/lib/forms/overtime.ts); until then there is no total.
    amount: ({ fields, lines }) =>
      lines.some((line) => line.amount)
        ? sum(lines, "amount") + number(fields.food)
        : null,
    summary: ({ fields, lines }) =>
      `${formatFormDate(fields.date ?? "")} · ${lines.length} ${lines.length === 1 ? "person" : "people"}`,
    linesNote:
      "The hours fill in from the start and end time. What each person is paid is worked out from their salary when the sheet is sent, and is shown to Accounts and the owners.",
  },
};

/** Forms raised from Reception, and from each department's workspace. */
export function formTypesRaisedIn(
  place: FormDefinition["raisedIn"],
): FormType[] {
  return FORM_TYPES.filter((type) => FORM_DEFINITIONS[type].raisedIn === place);
}

/** The list a kind of form is raised from and kept in. */
export function formListPath(orgCode: string, type: FormType): string {
  return `/${orgCode}/${FORM_DEFINITIONS[type].raisedIn}?section=${type}`;
}

export type ApprovalFormInput = FormAnswers & { staffId: string };

/** A form in a list. */
export type ApprovalFormView = {
  id: string;
  formType: FormType;
  referenceNo: string;
  /** The employee it is about, if any. */
  staffName: string;
  /** One line saying what it is, for lists. */
  summary: string;
  amount: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

/** AED with two decimals and thousands separators: 1,234.50 */
export function formatAmount(value: string | number | null): string {
  if (value === null || value === "") return "";
  return Number(value).toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
