/**
 * What each form prints, following the company's paper versions: the block
 * of details at the top, the table of lines, or the letter.
 */
import { appDateValue, formatFormDate } from "@/lib/datetime/format";
import {
  FORM_DEFINITIONS,
  MEDICAL_COMPANY_SHARE,
  VAT_RATE,
  formatAmount,
} from "@/lib/forms/definitions";
import type { ApprovalFormDocument } from "@/lib/forms/queries";

export type PrintedForm = {
  orientation: "portrait" | "landscape";
  /** Label and value rows above the table, left and right columns. */
  details: [string, string][];
  detailsRight: [string, string][];
  table: { columns: string[]; rows: string[][]; totals?: string[] } | null;
  /** Paragraphs, for a form that is a letter. */
  letter: string[];
  /** An unsigned box for the employee, signed on the printed copy. */
  employeeBox: string | null;
  /** The form has a "Remarks by Managing Partners only" box. */
  managingRemarks: boolean;
};

const money = (value: number) => formatAmount(value);
const num = (value: string | undefined) => Number(value) || 0;
/** An amount as typed; blank while nothing has been typed. */
const typed = (value: string | undefined) =>
  value?.trim() ? money(num(value)) : "";

export function printedForm(form: ApprovalFormDocument): PrintedForm {
  const { fields, lines } = form;
  const date = (key: string) => formatFormDate(fields[key] ?? "");
  const employeeName = form.employee?.fullName.toUpperCase() ?? "";
  const requester = [form.raisedBy.fullName, form.raisedBy.jobTitle]
    .filter(Boolean)
    .join(" ( ")
    .concat(form.raisedBy.jobTitle ? " )" : "")
    .toUpperCase();
  const reference: [string, string][] = [
    ["Ref No", form.referenceNo],
    ["Apply Date", formatFormDate(appDateValue(new Date(form.createdAt)))],
  ];

  switch (form.formType) {
    case "fine_notice":
      return {
        orientation: "portrait",
        details: [],
        detailsRight: [],
        table: null,
        letter: [
          `Dear ${form.employee?.fullName ?? ""},`,
          `Kindly be informed that it is noticed from the office that you have ${(fields.reason ?? "").trim().replace(/\.$/, "") || "…"}.`,
          `Hence there will be a fine of AED-${fields.amount?.trim() ? Number(fields.amount) : "…"}/- which will be deducted from your upcoming salary and strict action will be taken if you will continue the same with any staff from ${form.company.name}.`,
        ],
        employeeBox: `FINE ISSUED TO ${employeeName}`,
        managingRemarks: true,
      };

    case "medical_claim": {
      const total = num(fields.total);
      const company = Math.round(total * MEDICAL_COMPANY_SHARE * 100) / 100;
      const row = fields.total?.trim()
        ? [money(company), money(total - company), money(total)]
        : ["", "", ""];
      return {
        orientation: "portrait",
        details: reference,
        detailsRight: [],
        table: {
          columns: [
            "DATE",
            "STAFF NAME",
            "HOSPITAL NAME",
            "AMOUNT 70% PAID BY COMPANY",
            "AMOUNT 30% PAID BY EMPLOYEE",
            "TOTAL AMOUNT",
          ],
          rows: [[date("date"), employeeName, fields.hospital ?? "", ...row]],
          totals: ["TOTAL", "", "", ...row],
        },
        letter: [],
        employeeBox: `MEDICAL AMOUNT PAID TO ${employeeName}`,
        managingRemarks: false,
      };
    }

    case "petty_cash":
      return {
        orientation: "landscape",
        details: [
          ...reference,
          ["PROJECT NAME", fields.projectName ?? ""],
          ["PROJECT CODE", fields.projectCode ?? ""],
          ["PETTY CASH REQUEST GOES TO", "MD"],
          ["DESIGNATION", requester],
          ["DESCRIPTION OF THE WORK", fields.description ?? ""],
          ["REQUEST DATE", date("requestDate")],
        ],
        detailsRight: [],
        table: {
          columns: [
            "SN",
            "RECEIVED AMOUNT ( CREDIT )",
            "VEHICLE NO",
            "PAID BY",
            "FOOD FOR",
            "PETTY CASH DESCRIPTION",
            "QTY OF INVOICES",
            "INVOICES AMOUNT ( DEBIT )",
          ],
          rows: lines.map((line, index) => [
            String(index + 1),
            typed(line.receivedAmount),
            line.vehicleNo ?? "",
            line.paidBy ?? "",
            line.foodFor ?? "",
            line.description ?? "",
            line.invoiceQty ?? "",
            typed(line.invoiceAmount),
          ]),
          totals: [
            "GRAND TOTAL",
            "",
            "",
            "",
            "",
            "",
            String(lines.reduce((sum, line) => sum + num(line.invoiceQty), 0)),
            formatAmount(form.amount),
          ],
        },
        letter: [],
        employeeBox: null,
        managingRemarks: true,
      };

    case "material_request":
      return {
        orientation: "landscape",
        details: [
          ...reference,
          ["PROJECT NAME", fields.projectName ?? ""],
          ["PROJECT CODE", fields.projectCode ?? ""],
          ["MATERIAL REQUEST FROM THE SECTION", fields.section ?? ""],
          ["DESIGNATION", requester],
          ["DESCRIPTION OF THE WORK", fields.description ?? ""],
          ["REQUEST DATE", date("requestDate")],
        ],
        detailsRight: [
          ["Invoice No", fields.invoiceNo ?? ""],
          ["Job No", fields.jobNo ?? ""],
        ],
        table: {
          columns: [
            "SN",
            "MATERIAL DESCRIPTION",
            "QTY",
            "APPROVAL STATUS",
            "SPECIFICATION",
            "SAMPLE",
            "SAMPLE NO.",
          ],
          rows: lines.map((line, index) => [
            String(index + 1),
            line.materialDescription ?? "",
            line.qty ?? "",
            line.approvalStatus ?? "",
            line.specification ?? "",
            line.sample ?? "",
            line.sampleNo ?? "",
          ]),
        },
        letter: [],
        employeeBox: null,
        managingRemarks: true,
      };

    case "verbal_work_approval":
      return {
        orientation: "landscape",
        details: [
          ...reference,
          ["PROJECT NAME", fields.projectName ?? ""],
          ["VERBALLY WORK REQUEST BY", fields.requestedBy ?? ""],
          ["DESCRIPTION OF THE WORK", fields.description ?? ""],
          ["CUSTOMER NAME", fields.customerName ?? ""],
          ["JOB CARD NUMBER", fields.jobCardNumber ?? ""],
          ["REQUEST DATE", date("requestDate")],
        ],
        detailsRight: [
          ["Job No", fields.jobNo ?? ""],
          ["Delivery Note number", fields.deliveryNoteNumber ?? ""],
          ["Delivery Date", date("deliveryDate")],
          ["Invoice Amount in AED", formatAmount(form.amount)],
          ["Amount collected by", fields.amountCollectedBy ?? ""],
        ],
        table: {
          columns: [
            "SN",
            "APPROVED BY",
            "MATERIAL DESCRIPTION",
            "QTY",
            "JOB PRICE",
            "TOTAL",
            "VAT 5 %",
            "TOTAL AMOUNT",
            "SAMPLE NO.",
          ],
          rows: lines.map((line, index) => {
            const total = num(line.qty) * num(line.jobPrice);
            const priced = Boolean(line.qty?.trim() && line.jobPrice?.trim());
            return [
              String(index + 1),
              line.approvedBy ?? "",
              line.materialDescription ?? "",
              line.qty ?? "",
              typed(line.jobPrice),
              priced ? money(total) : "",
              priced ? money(total * VAT_RATE) : "",
              priced ? money(total * (1 + VAT_RATE)) : "",
              line.sampleNo ?? "",
            ];
          }),
        },
        letter: [],
        employeeBox: null,
        managingRemarks: true,
      };
  }
}

export function formTitle(form: ApprovalFormDocument): string {
  return FORM_DEFINITIONS[form.formType].title.toUpperCase();
}
