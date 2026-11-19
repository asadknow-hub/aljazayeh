"use client";

import type { ReactNode } from "react";
import { Letterhead } from "@/components/documents/letterhead";
import {
  Blank,
  BlankRows,
  cell,
  CompanyHeading,
  darkBar,
  darkHead,
  Fill,
  Line,
  PaperSheet,
  PaperTitle,
  Shaded,
  SignatureBox,
  usePaper,
} from "@/components/inquiries/paper";
import type { InquiryStageKey } from "@/lib/inquiries/stages";
import {
  amountInWords,
  formatMoney,
  lpoReference,
  STAGE_DEFINITIONS,
  stageFieldDisplay,
} from "@/lib/inquiries/stage-forms";

/**
 * The company's papers, laid out like the printed forms they replace. Each
 * one fills itself in from the steps before it; only what the form says is
 * written by hand can be typed.
 */

/** What the papers read from the rest of the job. */
function useJob() {
  const paper = usePaper();
  const step = (key: InquiryStageKey) =>
    paper.inquiry.steps.find((item) => item.key === key);
  /** A step's answers; for the step on screen, what is typed right now. */
  const answers = (key: InquiryStageKey) =>
    key === paper.stage ? paper.values : (step(key)?.fields ?? {});
  const customer = answers("inquiry");
  const channel = STAGE_DEFINITIONS.inquiry.fields.find(
    (field) => field.key === "receivedVia",
  );

  return {
    ...paper,
    step,
    answers,
    customer: {
      name: customer.customerName ?? paper.inquiry.customerName,
      attention: customer.contactPerson ?? "",
      contact: customer.contact ?? paper.inquiry.contact,
      email: customer.email ?? "",
      trn: customer.customerTrn ?? "",
      address: customer.customerAddress ?? "",
      channel: channel
        ? stageFieldDisplay(channel, customer.receivedVia ?? "")
        : "",
    },
    numbers: {
      inquiry: paper.inquiry.number,
      quotation: step("quotation")?.documentNumber ?? "",
      lpo: lpoReference({
        documentNumber: step("lpo")?.documentNumber ?? "",
        fields: answers("lpo"),
      }),
      purchaseOrder: step("lpo")?.documentNumber ?? "",
      proforma: step("proforma_invoice")?.documentNumber ?? "",
      jobCard: step("job_card")?.documentNumber ?? "",
      compliance:
        step("job_card")?.documentNumbers.compliance_certificate ?? "",
      coating: step("job_card")?.documentNumbers.coating_certificate ?? "",
      progress: step("progress_invoice")?.documentNumber ?? "",
      deliveryNote: step("delivery_note")?.documentNumber ?? "",
      taxInvoice: step("tax_invoice")?.documentNumber ?? "",
      commercialInvoice: step("commercial_invoice")?.documentNumber ?? "",
      packingList:
        step("commercial_invoice")?.documentNumbers.packing_list ?? "",
      receipt: step("receipt_voucher")?.documentNumber ?? "",
    },
    preparedBy: step(paper.stage)?.preparedByName ?? "",
  };
}

const amountOf = (item: { quantity: string; unitPrice: string }) =>
  (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);

function BankDetails({ title }: { title: string }) {
  const { company } = usePaper();
  return (
    <div>
      <p className="mb-1 font-bold uppercase">{title}</p>
      <Line label="Bank Name:">{company.bankName}</Line>
      <Line label="Account Name:">{company.bankAccountName}</Line>
      <Line label="Account No:">{company.bankAccountNumber}</Line>
      <Line label="IBAN:">{company.bankIban}</Line>
      {company.bankSwift ? (
        <Line label="SWIFT Code:">{company.bankSwift}</Line>
      ) : null}
      <Line label="Branch:">{company.bankBranch}</Line>
    </div>
  );
}

function TotalsLines({ grandLabel }: { grandLabel: string }) {
  const { totals } = usePaper();
  return (
    <>
      <tr>
        <td className="py-1 pr-4 text-right font-semibold">Subtotal:</td>
        <td className="py-1 text-right">AED {formatMoney(totals.subtotal)}</td>
      </tr>
      {totals.discount > 0 ? (
        <tr>
          <td className="py-1 pr-4 text-right font-semibold">Discount:</td>
          <td className="py-1 text-right">
            − AED {formatMoney(totals.discount)}
          </td>
        </tr>
      ) : null}
      <tr>
        <td className="py-1 pr-4 text-right font-semibold">
          Total VAT ({totals.vatPercent}%):
        </td>
        <td className="py-1 text-right">AED {formatMoney(totals.vat)}</td>
      </tr>
      <tr className="bg-[#3a3a3f] font-bold text-white">
        <td className="px-2 py-1.5 text-right">{grandLabel}</td>
        <td className="px-2 py-1.5 text-right">
          AED {formatMoney(totals.total)}
        </td>
      </tr>
    </>
  );
}

/* -------------------------------- quotation ------------------------------- */

function QuotationPaper() {
  const job = useJob();
  const { items, totals, company, inquiry } = job;
  const terms: [string, string][] = [
    ["Material Scope & Standards", "termMaterial"],
    ["Delivery Scope & Logistics", "termDelivery"],
    ["Production Lead Time", "termLeadTime"],
    ["Terms of Payment", "termPayment"],
    ["Quotation Validity", "termValidity"],
  ];

  return (
    <PaperSheet>
      <CompanyHeading />
      <PaperTitle>
        {inquiry.jobType === "export" ? "Commercial Quotation" : "Quotation"}
      </PaperTitle>
      <hr className="mb-4 border-slate-500" />

      <Shaded className="grid grid-cols-2 gap-4">
        <div>
          <p className="mb-1 font-bold uppercase">Client / Customer Details</p>
          <Line label="Company Name:">{job.customer.name}</Line>
          <Line label="Attention:">{job.customer.attention}</Line>
          <Line label="Contact / WhatsApp:">{job.customer.contact}</Line>
          <Line label="Email Address:">{job.customer.email}</Line>
          <Line label="TRN (VAT No.):">{job.customer.trn}</Line>
          <Line label="Address:">{job.customer.address}</Line>
        </div>
        <div>
          <p className="mb-1 font-bold uppercase">Quotation Reference Details</p>
          <Line label="Quotation Reference No:">
            {job.numbers.quotation}
          </Line>
          <Line label="Inquiry Channel:">{job.customer.channel}</Line>
          <Line label="Query Ref No:">{job.numbers.inquiry}</Line>
          <Line label="Quotation Date:">
            <Fill name="quotationDate" />
          </Line>
          <Line label="Valid Until:">
            <Fill name="validUntil" />
          </Line>
        </div>
      </Shaded>

      <p className="mt-5 font-bold">Dear Valued Client,</p>
      <p className="mt-1">
        Thank you for reaching out to us. We are pleased to offer our official
        commercial quotation for your metal fabrication requirements as detailed
        below.
      </p>

      <p className="mt-4 mb-1.5 text-[13px] font-bold uppercase">
        BOQ &amp; Fabrication Price Breakdown
      </p>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${darkHead} w-9`}>Sr.</th>
            <th className={darkHead}>
              Description of Fabrication Items &amp; Material Specs
            </th>
            <th className={`${darkHead} w-16`}>Unit</th>
            <th className={`${darkHead} w-16`}>Qty</th>
            <th className={`${darkHead} w-24 text-right`}>Unit Price (AED)</th>
            <th className={`${darkHead} w-24 text-right`}>Total (AED)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id ?? `new-${index}`} className="even:bg-[#eef1f6]">
              <td className={cell}>{index + 1}</td>
              <td className={cell}>
                {item.description}
              </td>
              <td className={cell}>
                {item.unit}
              </td>
              <td className={cell}>
                {item.quantity}
              </td>
              <td className={`${cell} text-right`}>
                {formatMoney(Number(item.unitPrice) || 0)}
              </td>
              <td className={`${cell} text-right tabular-nums`}>
                {formatMoney(amountOf(item))}
              </td>
            </tr>
          ))}
          <BlankRows have={items.length} columns={6} atLeast={5} />
        </tbody>
      </table>

      <table className="mt-3 ml-auto w-[60%] border-collapse">
        <tbody>
          <tr>
            <td className="py-1 pr-4 text-right">Subtotal (AED) :</td>
            <td className="w-32 py-1 text-right tabular-nums">
              {formatMoney(totals.subtotal)}
            </td>
          </tr>
          <tr>
            <td className="py-1 pr-4 text-right">Discount :</td>
            <td className="py-1 text-right">
              <Fill name="discount" />
            </td>
          </tr>
          <tr>
            <td className="py-1 pr-4 text-right">
              VAT @ <Fill name="vatPercent" />% :
            </td>
            <td className="py-1 text-right tabular-nums">
              {formatMoney(totals.vat)}
            </td>
          </tr>
          <tr className="bg-[#e6eaf2] font-bold">
            <td className="px-2 py-2 text-right uppercase">
              Net Total Amount (AED) :
            </td>
            <td className="px-2 py-2 text-right tabular-nums">
              {formatMoney(totals.total)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-8 break-before-page border-t border-dashed border-slate-300 pt-6 print:mt-0 print:border-0 print:pt-0">
        <Line label="Amount in Words:">
          <em>{amountInWords(totals.total)}</em>
        </Line>

        <p className="mt-4 mb-1 text-[13px] font-bold uppercase">
          Terms &amp; Conditions
        </p>
        <ol className="ml-5 list-decimal space-y-1.5">
          {terms.map(([label, key]) => (
            <li key={key}>
              <span className="font-semibold">{label}:</span>{" "}
              <Fill name={key} />
            </li>
          ))}
        </ol>

        <Shaded className="mt-6 w-[62%]">
          <BankDetails title="Bank Details for Payment" />
        </Shaded>

        <p className="mt-8 font-bold">For {company.name}</p>
        <div className="mt-14 w-64 border-t border-slate-600 pt-1">
          Authorized Signature &amp; Stamp
        </div>
      </div>
    </PaperSheet>
  );
}

/* ----------------------------- purchase order ----------------------------- */

function PurchaseOrderPaper() {
  const job = useJob();
  const { company } = job;
  const rows = job.tables.poLines ?? [];
  const vat = job.totals.vatPercent;
  const lineTotal = (row: Record<string, string>) =>
    (parseFloat(row.quantity ?? "") || 0) * (Number(row.rate) || 0);
  const total = rows.reduce((sum, row) => sum + lineTotal(row), 0);
  const withTax = total * (1 + vat / 100);
  const box = "border border-black px-1.5 py-1";

  const pair = (
    left: [string, ReactNode],
    right: [string, ReactNode],
  ): ReactNode => (
    <>
      <tr>
        <td className={`${box} font-bold`}>{left[0]}</td>
        <td className={`${box} font-bold`}>{right[0]}</td>
      </tr>
      <tr>
        <td className={`${box} h-6 font-bold`}>{left[1]}</td>
        <td className={`${box} h-6 font-bold`}>{right[1]}</td>
      </tr>
    </>
  );

  return (
    <PaperSheet>
      <Letterhead company={company} />
      <h3
        className="mt-4 text-center text-[19px] font-bold uppercase"
        style={{ fontFamily: "inherit" }}
      >
        Purchase Order
      </h3>

      <div className="grid grid-cols-[42%_58%]">
        <div className="flex items-center justify-center p-2">
          {company.logoImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing to optimise
            <img src={company.logoImage} alt="" className="h-28 w-auto" />
          ) : null}
        </div>
        <table className="w-full border-collapse">
          <tbody>
            {pair(
              ["Voucher No.", job.numbers.purchaseOrder],
              ["Dated", <Fill key="d" name="poDate" />],
            )}
            {pair(
              ["Mode/Terms of Payment", <Fill key="m" name="poPaymentMode" />],
              ["Other Reference(s)", <Fill key="o" name="poOtherReference" />],
            )}
            {pair(
              ["Supplier's Ref./Order No.", <Fill key="s" name="poSupplierRef" />],
              ["Despatch through", <Fill key="t" name="poDespatch" />],
            )}
            {pair(
              ["Destination", <Fill key="x" name="poDestination" />],
              ["Terms of Delivery", <Fill key="y" name="poDeliveryTerms" />],
            )}
          </tbody>
        </table>

        <div className="border border-black">
          <div className="border-b border-black px-1.5 py-1 leading-[1.6] font-bold">
            <p className="text-[14px] uppercase">{company.name}</p>
            {company.poBox ? <p>{company.poBox}</p> : null}
            {company.address ? <p>{company.address}</p> : null}
            {company.trn ? <p>TRN: {company.trn}</p> : null}
            {company.telephone ? <p>Contact: {company.telephone}</p> : null}
            {company.email ? <p>E-mail: {company.email}</p> : null}
          </div>
          <p className="border-b border-black px-1.5 py-0.5 font-bold">
            Consignee:
          </p>
          <p className="border-b border-black px-1.5 py-1 font-bold uppercase">
            <Fill name="supplierName" />
          </p>
          <p className="border-b border-black px-1.5 py-1 font-bold">
            PH: <Fill name="supplierPhone" />
          </p>
          <p className="border-b border-black px-1.5 py-1 font-bold">
            Emirate : <Fill name="supplierEmirate" />
          </p>
          <p className="px-1.5 py-1 font-bold">
            TRN : <Fill name="supplierTrn" />
          </p>
        </div>
        <div className="border border-l-0 border-black px-1.5 py-1 font-bold">
          <p>TERMS AND CONDITIONS:</p>
          <div className="mt-1">
            <Fill name="poTerms" />
          </div>
        </div>
      </div>

      <table className="w-full border-collapse text-center font-bold">
        <thead>
          <tr>
            <th className={`${box} w-10`}>SN</th>
            <th className={box}>Item &amp; Description</th>
            <th className={`${box} w-28`}>QTY</th>
            <th className={`${box} w-20`}>RATE</th>
            <th className={`${box} w-24`}>TOTAL AMOUNT</th>
            <th className={`${box} w-20`}>Tax {vat}%</th>
            <th className={`${box} w-28`}>Total Amount Including Vat</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td className={box}>{index + 1}</td>
              <td className={box}>
                {row.description}
              </td>
              <td className={box}>
                {row.quantity}
              </td>
              <td className={box}>
                {formatMoney(Number(row.rate) || 0)}
              </td>
              <td className={box}>{formatMoney(lineTotal(row))}</td>
              <td className={box}>
                {formatMoney((lineTotal(row) * vat) / 100)}
              </td>
              <td className={box}>
                {formatMoney(lineTotal(row) * (1 + vat / 100))}
              </td>
            </tr>
          ))}
          <tr>
            <td className={`${box} text-right`} colSpan={4}>
              TOTAL
            </td>
            <td className={box}>{formatMoney(total)}</td>
            <td className={box}>{formatMoney(withTax - total)}</td>
            <td className={box}>{formatMoney(withTax)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-1 flex justify-between">
        <span>Amount Chargeable (in words)</span>
        <span>E. &amp; O.E</span>
      </div>
      <p className="font-bold">{amountInWords(withTax)}</p>

      <div className="mt-24 ml-auto w-72 border-l-2 border-black py-2 pr-1 text-right font-bold">
        <p>For {company.name}</p>
        <p>Authority Signatory</p>
      </div>
    </PaperSheet>
  );
}

/* --------------------------------- invoices -------------------------------- */

const INVOICE_TERMS = (company: string) => [
  "Payment must be cleared on or before the due date.",
  "Late payments may incur a charge of 1.5% per month.",
  "Goods/Services delivered are deemed accepted.",
  "Title of goods remains with issuer until full payment.",
  `Cheques payable to '${company}'.`,
];

/** The tax invoice, and the proforma and progress invoices that share its form. */
function InvoicePaper({
  kind,
}: {
  kind: "tax_invoice" | "proforma_invoice" | "progress_invoice";
}) {
  const job = useJob();
  const { items, totals, company, values } = job;
  const title =
    kind === "tax_invoice"
      ? "Tax Invoice"
      : kind === "proforma_invoice"
        ? "Proforma Invoice"
        : "Progress Invoice";
  const number =
    kind === "tax_invoice"
      ? job.numbers.taxInvoice
      : kind === "proforma_invoice"
        ? job.numbers.proforma
        : job.numbers.progress;
  const dateField = kind === "proforma_invoice" ? "proformaDate" : "invoiceDate";

  const advance =
    Number(values.advanceAmount) ||
    (totals.total * (Number(values.advancePercent) || 0)) / 100;
  const billedNow =
    Number(values.amount) ||
    (totals.total * (Number(values.progressPercent) || 0)) / 100;
  const previous = Number(values.previousOutstanding) || 0;

  return (
    <PaperSheet>
      <CompanyHeading />
      <PaperTitle>{title}</PaperTitle>

      <Shaded className="grid grid-cols-[1.25fr_1fr_1fr] gap-3">
        <div>
          <p className="mb-1 font-bold uppercase">Bill To / Client Details</p>
          <Line label="Company Name:">{job.customer.name}</Line>
          <Line label="TRN No:">{job.customer.trn}</Line>
          <Line label="Address:">{job.customer.address}</Line>
          <Line label="Contact Person:">{job.customer.attention}</Line>
          <Line label="Phone / Email:">
            {[job.customer.contact, job.customer.email]
              .filter(Boolean)
              .join(" / ")}
          </Line>
        </div>
        <div>
          <Line label="Invoice No:">
            {number}
          </Line>
          <Line label="Invoice Date:">
            <Fill name={dateField} />
          </Line>
          <Line label="Payment Terms:">
            <Fill name="paymentTerms" />
          </Line>
          <Line label="Due Date:">
            <Fill name="dueDate" />
          </Line>
        </div>
        <div>
          <Line label="Quote Ref No:">{job.numbers.quotation}</Line>
          <Line label="LPO / PO No:">{job.numbers.lpo}</Line>
          <Line label="Delivery Note No:">{job.numbers.deliveryNote}</Line>
          <Line label="Job Card No:">{job.numbers.jobCard}</Line>
        </div>
      </Shaded>

      <table className="mt-5 w-full border-collapse">
        <thead>
          <tr>
            <th className={`${darkHead} w-10`}>S.N.</th>
            <th className={darkHead}>Item / Description</th>
            <th className={`${darkHead} w-16 text-center`}>Qty</th>
            <th className={`${darkHead} w-16 text-center`}>Unit</th>
            <th className={`${darkHead} w-24 text-right`}>Unit Price (AED)</th>
            <th className={`${darkHead} w-24 text-right`}>Total (AED)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id ?? index}>
              <td className={`${cell} border-black text-center`}>{index + 1}</td>
              <td className={`${cell} border-black`}>{item.description}</td>
              <td className={`${cell} border-black text-center`}>
                {item.quantity}
              </td>
              <td className={`${cell} border-black text-center`}>{item.unit}</td>
              <td className={`${cell} border-black text-right tabular-nums`}>
                {formatMoney(Number(item.unitPrice) || 0)}
              </td>
              <td className={`${cell} border-black text-right tabular-nums`}>
                {formatMoney(amountOf(item))}
              </td>
            </tr>
          ))}
          <BlankRows have={items.length} columns={6} />
        </tbody>
      </table>

      <table className="mt-4 ml-auto w-[48%] border-collapse tabular-nums">
        <tbody>
          <TotalsLines grandLabel="Grand Total (Incl. VAT):" />
        </tbody>
      </table>
      <p className="mt-1 ml-auto w-[48%]">
        <span className="font-bold">Amount in Words:</span>{" "}
        <em>{amountInWords(totals.total)}</em>
      </p>

      {kind === "tax_invoice" ? (
        <>
          <p className="mt-4 mb-1 font-bold uppercase">
            Credit &amp; Account Summary
          </p>
          <table className="w-full border-collapse text-center">
            <thead>
              <tr className="bg-[#e6eaf2]">
                <th className="py-1.5">Approved Credit Limit</th>
                <th className="py-1.5">Current Invoice Amount</th>
                <th className="py-1.5">Previous Outstanding Balance</th>
                <th className="py-1.5">Total Due Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1.5">
                  AED <Fill name="creditLimit" />
                </td>
                <td className="py-1.5">AED {formatMoney(totals.total)}</td>
                <td className="py-1.5">
                  AED <Fill name="previousOutstanding" />
                </td>
                <td className="py-1.5 font-bold">
                  AED {formatMoney(totals.total + previous)}
                </td>
              </tr>
            </tbody>
          </table>
        </>
      ) : (
        <Shaded className="mt-4">
          {kind === "proforma_invoice" ? (
            <>
              <p className="mb-1 font-bold uppercase">Advance Payment</p>
              <Line label="Advance:">
                <Fill name="advancePercent" /> % of
                the grand total
              </Line>
              <Line label="Advance amount (AED):">
                <Fill name="advanceAmount" />
              </Line>
              <Line label="Payable now:">AED {formatMoney(advance)}</Line>
            </>
          ) : (
            <>
              <p className="mb-1 font-bold uppercase">Progress Billing</p>
              <Line label="Work completed:">
                <Fill name="progressPercent" /> %
              </Line>
              <Line label="Amount billed now (AED):">
                <Fill name="amount" />
              </Line>
              <Line label="Payable now:">AED {formatMoney(billedNow)}</Line>
            </>
          )}
        </Shaded>
      )}

      <div className="mt-5 grid grid-cols-2 gap-6">
        <BankDetails title="Bank Payment Details" />
        <div>
          <p className="mb-1 font-bold uppercase">Terms &amp; Conditions</p>
          <ol className="ml-4 list-decimal space-y-0.5">
            {INVOICE_TERMS(company.name).map((term) => (
              <li key={term}>{term}</li>
            ))}
          </ol>
        </div>
      </div>
    </PaperSheet>
  );
}

/* --------------------------------- job card -------------------------------- */

function JobCardPaper() {
  const job = useJob();
  const { items } = job;
  const label = "bg-[#e6eaf2] px-2 py-2.5 font-bold border border-slate-300 w-[20%]";
  const value = "px-2 py-2.5 border border-slate-300 w-[30%]";
  const person = (title: string, name: string) => (
    <div className="border border-slate-300 px-2 py-2 leading-[2.2]">
      <p className="font-bold">{title}</p>
      <p>
        Name: <Fill name={name} blank="w-36" />
      </p>
      <p>
        Sign: <Blank className="w-36" />
      </p>
      <p>
        Date: <Blank className="w-28" />
      </p>
    </div>
  );

  return (
    <PaperSheet>
      <CompanyHeading />
      <h3
        className="mt-3 mb-3 text-center text-[26px] font-bold uppercase"
        style={{ fontFamily: "inherit" }}
      >
        Job Card
      </h3>

      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className={label}>Client / Co. Name:</td>
            <td className={value}>{job.customer.name}</td>
            <td className={label}>ORDER NO:</td>
            <td className={value}>
              {job.numbers.jobCard}
            </td>
          </tr>
          <tr>
            <td className={label}>Phone / Mobile:</td>
            <td className={value}>{job.customer.contact}</td>
            <td className={label}>Expected Delivery:</td>
            <td className={value}>
              <Fill name="expectedDelivery" />
            </td>
          </tr>
          <tr>
            <td className={label}>Po No:</td>
            <td className={value}>{job.numbers.lpo}</td>
            <td className={label}>Prepared By:</td>
            <td className={value}>{job.preparedBy}</td>
          </tr>
        </tbody>
      </table>

      <p className={`${darkBar} mt-5`}>Scope of Work &amp; Instructions</p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#e6eaf2]">
            <th className={`${cell} w-12`}>S/N</th>
            <th className={`${cell} text-left`}>Task / Job Description</th>
            <th className={`${cell} w-24`}>QTY</th>
            <th className={`${cell} w-[34%]`}>Remark</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id ?? index}>
              <td className={`${cell} text-center`}>{index + 1}</td>
              <td className={cell}>{item.description}</td>
              <td className={`${cell} text-center`}>
                {item.quantity} {item.unit}
              </td>
              <td className={cell}>
                {item.details.jobRemark}
              </td>
            </tr>
          ))}
          <BlankRows have={items.length} columns={4} />
        </tbody>
      </table>

      <div className="mt-6 grid grid-cols-3">
        {person("Assigned Technician", "technician1")}
        {person("Assigned Technician", "technician2")}
        {person("Workshop Supervisor", "supervisor")}
      </div>

      <p className={`${darkBar} mt-5`}>Time Log &amp; Technician Remarks</p>
      <div className="grid grid-cols-2 border border-slate-300">
        <div className="px-2 py-2 leading-[2]">
          <p className="font-bold">Labor &amp; Time Log:</p>
          <p>
            • Start Date / Time: <Fill name="startDate" blank="w-20" /> at{" "}
            <Fill name="startTime" blank="w-14" />
          </p>
          <p>
            • End Date / Time: <Fill name="endDate" blank="w-20" /> at{" "}
            <Fill name="endTime" blank="w-14" />
          </p>
          <p>
            • Total Technician Hours:{" "}
            <Fill name="technicianHours" blank="w-16" /> Hours
          </p>
          <p>
            • Total Overtime Hours:{" "}
            <Fill name="overtimeHours" blank="w-16" /> Hours
          </p>
        </div>
        <div className="border-l border-slate-300 px-2 py-2">
          <Fill name="technicianRemarks" />
        </div>
      </div>
    </PaperSheet>
  );
}

/* ------------------------------ certificates ------------------------------ */

function IssuedBy({ stamp }: { stamp: string }) {
  const { company } = usePaper();
  return (
    <Shaded className="mt-6 w-[52%]">
      <p className="font-bold uppercase">Inspected &amp; Issued By:</p>
      <p>Department : Quality Control (QC)</p>
      <p>
        Company : <span className="uppercase">{company.name}</span>
      </p>
      <p className="mt-3 font-bold uppercase">Authorized Sign &amp; Stamp:</p>
      <div className="mt-8">
        <SignatureBox>[ {stamp} ]</SignatureBox>
      </div>
    </Shaded>
  );
}

function ComplianceCertificatePaper() {
  const job = useJob();
  const { items } = job;

  return (
    <PaperSheet>
      <CompanyHeading />
      <PaperTitle underlined>Certificate of Compliance</PaperTitle>

      <Shaded className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-bold uppercase">Customer Details:</p>
          <Line label="Customer Name :">{job.customer.name}</Line>
          <Line label="L.P.O. Number :">{job.numbers.lpo}</Line>
          <Line label="Job Order No :">{job.numbers.jobCard}</Line>
        </div>
        <div>
          <p className="font-bold uppercase">Certificate Details:</p>
          <Line label="Certificate No :">
            {job.numbers.compliance}
          </Line>
          <Line label="Issue Date :">
            <Fill name="complianceIssueDate" />
          </Line>
        </div>
      </Shaded>

      <Shaded className="mt-5">
        We hereby confirm and certify that the material/components listed below
        have been fully machined and processed in our workshop. The materials
        strictly comply with the Customer Purchase Order requirements, ASME/ASTM
        material standards, and original manufacturer&apos;s technical
        specifications.
      </Shaded>

      <table className="mt-5 w-full border-collapse">
        <thead>
          <tr>
            <th className={`${darkHead} w-10`}>S/N</th>
            <th className={darkHead}>Material Description &amp; Specifications</th>
            <th className={`${darkHead} w-20 text-center`}>Qty</th>
            <th className={`${darkHead} w-24 text-center`}>Heat No.</th>
            <th className={`${darkHead} w-24 text-center`}>Origin</th>
            <th className={`${darkHead} w-28 text-center`}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id ?? index} className="even:bg-[#eef1f6]">
              <td className={`${cell} text-center`}>{index + 1}</td>
              <td className={cell}>{item.description}</td>
              <td className={`${cell} text-center`}>
                {item.quantity} {item.unit}
              </td>
              <td className={cell}>
                {item.details.heatNo}
              </td>
              <td className={cell}>
                {item.details.origin}
              </td>
              <td className={cell}>
                {item.details.complianceRemark}
              </td>
            </tr>
          ))}
          <BlankRows have={items.length} columns={6} atLeast={3} />
        </tbody>
      </table>

      <IssuedBy stamp="OFFICIAL QA/QC STAMP & SIGNATURE" />
    </PaperSheet>
  );
}

function CoatingCertificatePaper() {
  const job = useJob();
  const { items } = job;
  const parameters: [string, string][] = [
    ["Coating Standard", "coatingStandard"],
    ["Raw Material Used", "coatingRawMaterial"],
    ["Passivation Process", "coatingPassivation"],
    ["Chemical Manufacturer", "coatingChemicalManufacturer"],
    ["Chemical Control", "coatingChemicalControl"],
  ];

  return (
    <PaperSheet>
      <CompanyHeading />
      <hr className="mt-3 border-slate-600" />
      <h3
        className="mt-3 text-center text-[19px] font-bold uppercase underline underline-offset-4"
        style={{ fontFamily: "inherit" }}
      >
        Coating Certificate
      </h3>
      <p className="mb-3 text-center italic">
        Inspection And Testing For Compliance With ASTM B 633 Standard
        Specification
      </p>

      <Shaded className="grid grid-cols-2 gap-4 font-bold">
        <div>
          <p>
            CLIENT NAME : <span className="font-normal">{job.customer.name}</span>
          </p>
          <p>
            CLIENT LPO NO : <span className="font-normal">{job.numbers.lpo}</span>
          </p>
        </div>
        <div>
          <p>
            CERTIFICATE NO :{" "}
            <span className="font-normal">
              {job.numbers.coating}
            </span>
          </p>
          <p>
            DATE OF ISSUE :{" "}
            <span className="font-normal">
              <Fill name="coatingIssueDate" />
            </span>
          </p>
        </div>
      </Shaded>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr>
            <th className={`${darkHead} w-16`}>ITEM NO</th>
            <th className={`${darkHead} text-center`}>ITEM DESCRIPTION</th>
            <th className={`${darkHead} w-24 text-center`}>QTY</th>
            <th className={`${darkHead} w-36 text-center`}>HEAT NO</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id ?? index} className="even:bg-[#eef1f6]">
              <td className={`${cell} text-center`}>{index + 1}</td>
              <td className={cell}>{item.description}</td>
              <td className={`${cell} text-center`}>
                {item.quantity} {item.unit}
              </td>
              <td className={cell}>
                {item.details.heatNo}
              </td>
            </tr>
          ))}
          <BlankRows have={items.length} columns={4} atLeast={3} />
        </tbody>
      </table>

      <p className="mt-4 mb-1 font-bold uppercase">
        Process &amp; Process Parameters (Electro Galvanizing)
      </p>
      <table className="w-full border-collapse">
        <tbody>
          {parameters.map(([label, key]) => (
            <tr key={key} className="even:bg-[#eef1f6]">
              <td className="w-[30%] border-b border-slate-200 px-1.5 py-1 font-bold">
                {label}
              </td>
              <td className="border-b border-slate-200 px-1.5 py-1">
                <Fill name={key} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 mb-1 font-bold uppercase">
        Quality Inspection &amp; Test Results
      </p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#e6eaf2] text-left">
            <th className="w-[25%] px-1.5 py-1">TEST PARAMETER</th>
            <th className="px-1.5 py-1">ACCEPTANCE CRITERIA / TEST DETAILS</th>
            <th className="w-[18%] px-1.5 py-1 text-center">RESULT / STATUS</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`${cell} font-bold`}>1. Appearance</td>
            <td className={cell}>
              Smooth, continuous coating, free from gross surface imperfections,
              blisters or bare spots.
            </td>
            <td className={`${cell} text-center font-bold`}>
              <Fill name="appearanceResult" />
            </td>
          </tr>
          <tr>
            <td className={`${cell} font-bold`}>2. Adhesion Test</td>
            <td className={cell}>
              Coating does not lift off or flake off when pried with a stout
              knife (ASTM B571).
            </td>
            <td className={`${cell} text-center font-bold`}>
              <Fill name="adhesionResult" />
            </td>
          </tr>
          <tr>
            <td className={`${cell} font-bold`}>3. Coating Thickness</td>
            <td className={cell}>
              Readings:{" "}
              <Fill name="thicknessReadings" />
            </td>
            <td className={`${cell} text-center font-bold`}>
              <Fill name="thicknessResult" />
            </td>
          </tr>
        </tbody>
      </table>

      <Shaded className="mt-4">
        <span className="font-bold">CERTIFICATION STATEMENT:</span>{" "}
        <em>
          This is to certify that the above-mentioned items have been processed,
          inspected, and tested in accordance with ASTM B 633 specifications and
          customer order requirements. The results are fully compliant with all
          applicable technical parameters.
        </em>
      </Shaded>

      <IssuedBy stamp="OFFICIAL STAMP & SIGNATURE" />
    </PaperSheet>
  );
}

/* ------------------------------ delivery note ------------------------------ */

function DeliveryNotePaper() {
  const job = useJob();
  const { items } = job;
  const blank = (label: string) => (
    <p className="leading-[2.3]">
      {label} : <Blank className="w-56" />
    </p>
  );

  return (
    <PaperSheet>
      <CompanyHeading />
      <PaperTitle>Delivery Note</PaperTitle>

      <div className="grid grid-cols-[1.4fr_1fr] gap-4">
        <div className="leading-[1.6]">
          <p className="font-bold uppercase">Delivery To:</p>
          <p>{job.customer.name}</p>
          <p>
            Address:{" "}
            <Fill name="deliveryAddress" />
          </p>
          <p className="mt-2">Contact Person: {job.customer.attention}</p>
          <p>
            Phone: {job.customer.contact}
            {job.customer.email ? ` | Email: ${job.customer.email}` : ""}
          </p>
          <p>Trn no: {job.customer.trn}</p>
        </div>
        <div className="text-[13.5px] leading-[1.7]">
          <p>
            DN No: {job.numbers.deliveryNote}
          </p>
          <p>
            Date: <Fill name="deliveryDate" />
          </p>
          <p>LPO Ref: {job.numbers.lpo}</p>
          <p className="mt-2">Job Card Ref: {job.numbers.jobCard}</p>
        </div>
      </div>

      <p className={`${darkBar} mt-4 !text-left`}>
        Delivery Item Details / Scope of Work Delivered
      </p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#e6eaf2]">
            <th className={`${cell} w-12`}>S/N</th>
            <th className={`${cell} text-left`}>
              Item Description / Scope of Work
            </th>
            <th className={`${cell} w-24`}>Ordered Qty</th>
            <th className={`${cell} w-24`}>Delivered Qty</th>
            <th className={`${cell} w-32`}>Remarks / Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id ?? index} className="even:bg-[#eef1f6]">
              <td className={`${cell} text-center`}>{index + 1}</td>
              <td className={cell}>{item.description}</td>
              <td className={`${cell} text-center`}>
                {item.quantity} {item.unit}
              </td>
              <td className={`${cell} text-center`}>
                {item.deliveredQuantity}
              </td>
              <td className={cell}>
                {item.details.deliveryRemark}
              </td>
            </tr>
          ))}
          <BlankRows have={items.length} columns={5} />
        </tbody>
      </table>

      <Shaded className="mt-1">
        <p className="font-bold uppercase">Receipt &amp; Acknowledgement Terms:</p>
        <p>
          1. Received the above-mentioned goods/services in good condition and as
          per specification.
        </p>
        <p>
          2. Any discrepancy or damage must be reported within 24 hours of
          delivery in writing.
        </p>
        <p>
          3. This Delivery Note serves as official proof of receipt of items
          mentioned above.
        </p>
      </Shaded>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <div>
          <p className="font-bold uppercase">Received By</p>
          {blank("Name")}
          {blank("Mobile No")}
          {blank("EID No")}
          {blank("Signature")}
          {blank("Date")}
          <p className="mt-1">Company Stamp</p>
          <div className="mt-1 h-24 border border-slate-400" />
        </div>
        <div>
          <p className="font-bold uppercase text-slate-700">Prepared By</p>
          <p className="mt-2">
            Name : <span className="font-bold">{job.preparedBy}</span>
          </p>
          <p className="mt-1 font-bold">Signature / Stamp</p>
          <SignatureBox>[ Official Signature / Stamp Box ]</SignatureBox>
        </div>
      </div>
    </PaperSheet>
  );
}

/* ------------------------ export: invoice and packing ----------------------- */

function CommercialInvoicePaper() {
  const job = useJob();
  const { items, totals, company } = job;
  const box = "border border-black px-1.5 py-1";

  return (
    <PaperSheet>
      <CompanyHeading />
      <hr className="mt-3 border-slate-700" />
      <PaperTitle>Commercial Invoice</PaperTitle>

      <div className="leading-[1.6]">
        <p className="font-bold uppercase">Invoice To:</p>
        <p className="uppercase">{job.customer.name}</p>
        <p>{job.customer.address}</p>
        <p>TRN / VAT NO: {job.customer.trn}</p>
        <p>Attn: {job.customer.attention}</p>
      </div>

      <table className="mt-4 w-full border-collapse font-bold">
        <tbody>
          <tr>
            <td className={`${box} w-1/2`}>
              INVOICE NO:{" "}
              <span className="font-normal">
                {job.numbers.commercialInvoice}
              </span>
            </td>
            <td className={box}>
              DATE:{" "}
              <span className="font-normal">
                <Fill name="ciDate" />
              </span>
            </td>
          </tr>
          <tr>
            <td className={box}>
              L.P.O NO: <span className="font-normal">{job.numbers.lpo}</span>
            </td>
            <td className={box}>
              DELIVERY ORDER:{" "}
              <span className="font-normal">{job.numbers.deliveryNote}</span>
            </td>
          </tr>
          <tr>
            <td className={box}>
              PACKING LIST NO:{" "}
              <span className="font-normal">{job.numbers.packingList}</span>
            </td>
            <td className={box}>
              PAYMENT TERMS:{" "}
              <span className="font-normal">
                <Fill name="ciPaymentTerms" />
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="mt-5 w-full border-collapse text-center">
        <thead>
          <tr className="font-bold">
            <th className={`${box} w-10`}>S/N</th>
            <th className={box}>Description</th>
            <th className={`${box} w-14`}>QTY</th>
            <th className={`${box} w-20`}>HEAT #</th>
            <th className={`${box} w-20`}>ORIGIN</th>
            <th className={`${box} w-20`}>HS CODE</th>
            <th className={`${box} w-20`}>UNIT PRICE</th>
            <th className={`${box} w-24`}>TOTAL AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id ?? index}>
              <td className={box}>{index + 1}</td>
              <td className={`${box} text-left`}>{item.description}</td>
              <td className={box}>{item.quantity}</td>
              <td className={box}>
                {item.details.heatNo}
              </td>
              <td className={box}>
                {item.details.origin}
              </td>
              <td className={box}>
                {item.details.hsCode}
              </td>
              <td className={`${box} text-right tabular-nums`}>
                {formatMoney(Number(item.unitPrice) || 0)}
              </td>
              <td className={`${box} text-right tabular-nums`}>
                {formatMoney(amountOf(item))}
              </td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className={`${box} text-right`} colSpan={7}>
              TOTAL
            </td>
            <td className={`${box} text-right tabular-nums`}>
              {formatMoney(totals.subtotal - totals.discount)}
            </td>
          </tr>
          <tr className="font-bold">
            <td className={`${box} text-right`} colSpan={7}>
              VAT {totals.vatPercent}%
            </td>
            <td className={`${box} text-right tabular-nums`}>
              {formatMoney(totals.vat)}
            </td>
          </tr>
          <tr className="font-bold">
            <td className={`${box} text-right`} colSpan={7}>
              GRAND TOTAL
            </td>
            <td className={`${box} text-right tabular-nums`}>
              {formatMoney(totals.total)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-8 leading-[2.2]">
        <p className="uppercase">Bank Details</p>
        <p>Bank Name : {company.bankName}</p>
        <p>Account Name: {company.bankAccountName}</p>
        <p>IBAN Number : {company.bankIban}</p>
        <p>SWIFT / BIC : {company.bankSwift}</p>
      </div>

      <Shaded className="mt-4 w-[45%]">
        <p className="font-bold uppercase">For {company.name}</p>
        <div className="mt-6">
          <SignatureBox>[ OFFICIAL QA/QC STAMP &amp; SIGNATURE ]</SignatureBox>
        </div>
      </Shaded>
    </PaperSheet>
  );
}

function PackingListPaper() {
  const job = useJob();
  const { items } = job;
  const packages = job.tables.packages ?? [];

  return (
    <PaperSheet>
      <CompanyHeading />
      <PaperTitle>Packing List</PaperTitle>

      <Shaded className="grid grid-cols-2 gap-4 text-[13px]">
        <div>
          <p className="mb-1 font-bold uppercase">Consignee / Ship To Details</p>
          <Line label="Company Name:">{job.customer.name}</Line>
          <Line label="Consignee TRN:">{job.customer.trn}</Line>
          <Line label="Delivery Site Address:">
            <Fill name="deliverySiteAddress" />
          </Line>
          <Line label="Site Contact Person:">
            <Fill name="siteContactPerson" />
          </Line>
          <Line label="Contact / WhatsApp:">
            <Fill name="siteContact" />
          </Line>
          <Line label="Final Destination:">
            <Fill name="finalDestination" />
          </Line>
        </div>
        <div>
          <p className="mb-1 font-bold uppercase">
            Packing &amp; Shipping Reference
          </p>
          <Line label="Packing List No:">
            {job.numbers.packingList}
          </Line>
          <Line label="Dispatch Date:">
            <Fill name="dispatchDate" />
          </Line>
          <Line label="LPO Ref No:">{job.numbers.lpo}</Line>
          <Line label="Invoice Ref:">{job.numbers.commercialInvoice}</Line>
          <Line label="Carrier / Freight Co:">
            <Fill name="carrier" />
          </Line>
          <Line label="Vehicle / Container No:">
            <Fill name="vehicleNumber" />
          </Line>
          <Line label="Port of Loading / Origin:">
            <Fill name="portOfLoading" />
          </Line>
        </div>
      </Shaded>

      <p className="mt-5 mb-1 text-[13px] font-bold uppercase">
        Itemized Shipping Manifest
      </p>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${darkHead} w-10`}>S/N</th>
            <th className={darkHead}>Description</th>
            <th className={`${darkHead} w-16 text-center`}>Qty</th>
            <th className={`${darkHead} w-24 text-center`}>HS CODE</th>
            <th className={`${darkHead} w-24 text-center`}>HEAT #</th>
            <th className={`${darkHead} w-24 text-center`}>ORIGIN</th>
            <th className={`${darkHead} w-24 text-center`}>PACK NO.</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id ?? index} className="even:bg-[#eef1f6]">
              <td className={`${cell} text-center`}>{index + 1}</td>
              <td className={cell}>{item.description}</td>
              <td className={`${cell} text-center`}>{item.quantity}</td>
              <td className={cell}>
                {item.details.hsCode}
              </td>
              <td className={cell}>
                {item.details.heatNo}
              </td>
              <td className={cell}>
                {item.details.origin}
              </td>
              <td className={cell}>
                {item.details.packNo}
              </td>
            </tr>
          ))}
          <BlankRows have={items.length} columns={7} atLeast={3} />
        </tbody>
      </table>

      <p className="mt-5 mb-1 text-[13px] font-bold uppercase">
        Packaging Breakdown
      </p>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${darkHead} w-32`}>Mark / Pkg No.</th>
            <th className={darkHead}>Package Type</th>
            <th className={`${darkHead} w-28`}>Gross Wt.</th>
            <th className={`${darkHead} w-44`}>Dimensions (LxWxH)</th>
          </tr>
        </thead>
        <tbody>
          {packages.map((pack, index) => (
            <tr key={index} className="even:bg-[#eef1f6]">
              {["mark", "packageType", "grossWeight", "dimensions"].map(
                (column) => (
                  <td key={column} className={cell}>
                    {pack[column]}
                  </td>
                ),
              )}
            </tr>
          ))}
          <BlankRows have={packages.length} columns={4} atLeast={2} />
        </tbody>
      </table>

      <Shaded className="mt-2 text-center font-bold">
        TOTAL GROSS WEIGHT:{" "}
        <Fill name="totalGrossWeight" /> KG
      </Shaded>

      <p className="mt-5 mb-1 text-[13px] font-bold uppercase">
        Packing &amp; Logistics Instructions
      </p>
      <ol className="ml-5 list-decimal space-y-0.5">
        <li>
          <span className="font-bold">Packaging Standard:</span> All wooden
          packaging complies with ISPM-15 heat-treated/fumigated standards for
          international export.
        </li>
        <li>
          <span className="font-bold">Shipping Marks:</span> Packages are
          clearly marked with Consignee Name, Destination Port, Gross/Net
          Weight, and Package Number.
        </li>
      </ol>
    </PaperSheet>
  );
}

/* ----------------------------- receipt voucher ----------------------------- */

function ReceiptVoucherPaper() {
  const job = useJob();
  const { totals, values } = job;
  const received = Number(values.amountReceived) || 0;

  return (
    <PaperSheet>
      <CompanyHeading />
      <PaperTitle>Receipt Voucher</PaperTitle>

      <Shaded className="grid grid-cols-2 gap-4">
        <div>
          <Line label="Voucher No:">
            {job.numbers.receipt}
          </Line>
          <Line label="Date:">
            <Fill name="receiptDate" />
          </Line>
        </div>
        <div>
          <Line label="Tax Invoice No:">{job.numbers.taxInvoice}</Line>
          <Line label="LPO / PO No:">{job.numbers.lpo}</Line>
        </div>
      </Shaded>

      <div className="mt-5 space-y-2.5 text-[13.5px]">
        <p>
          <span className="font-bold">Received from:</span>{" "}
          <Fill name="receivedFrom" />
        </p>
        <p>
          <span className="font-bold">The sum of AED:</span>{" "}
          <Fill name="amountReceived" />
        </p>
        <p>
          <span className="font-bold">Amount in words:</span>{" "}
          <em>{received ? amountInWords(received) : ""}</em>
        </p>
        <p>
          <span className="font-bold">Paid by:</span> <Fill name="paymentMethod" />
          <span className="ml-6 font-bold">Cheque / transfer ref:</span>{" "}
          <Fill name="reference" />
        </p>
        <p>
          <span className="font-bold">Bank:</span>{" "}
          <Fill name="bank" />
        </p>
        <p>
          <span className="font-bold">Being payment for:</span>{" "}
          <Fill name="remarks" />
        </p>
      </div>

      <table className="mt-6 ml-auto w-[48%] border-collapse tabular-nums">
        <tbody>
          <tr>
            <td className="py-1 pr-4 text-right font-semibold">Invoice total:</td>
            <td className="py-1 text-right">AED {formatMoney(totals.total)}</td>
          </tr>
          <tr>
            <td className="py-1 pr-4 text-right font-semibold">Received now:</td>
            <td className="py-1 text-right">AED {formatMoney(received)}</td>
          </tr>
          <tr className="bg-[#3a3a3f] font-bold text-white">
            <td className="px-2 py-1.5 text-right">Balance:</td>
            <td className="px-2 py-1.5 text-right">
              AED {formatMoney(Math.max(0, totals.total - received))}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-12 grid grid-cols-2 gap-10">
        <div>
          <p className="font-bold uppercase">Received By</p>
          <p className="mt-2">Name : {job.preparedBy}</p>
          <SignatureBox>[ Signature / Stamp ]</SignatureBox>
        </div>
        <div>
          <p className="font-bold uppercase">Paid By</p>
          <p className="mt-2">
            Name : <Blank className="w-44" />
          </p>
          <SignatureBox>[ Customer Signature ]</SignatureBox>
        </div>
      </div>
    </PaperSheet>
  );
}

/** The paper for one of a step's documents. */
export function StagePaper({ document }: { document: string }) {
  switch (document) {
    case "quotation":
      return <QuotationPaper />;
    case "purchase_order":
      return <PurchaseOrderPaper />;
    case "proforma_invoice":
    case "progress_invoice":
    case "tax_invoice":
      return <InvoicePaper kind={document} />;
    case "job_card":
      return <JobCardPaper />;
    case "compliance_certificate":
      return <ComplianceCertificatePaper />;
    case "coating_certificate":
      return <CoatingCertificatePaper />;
    case "delivery_note":
      return <DeliveryNotePaper />;
    case "commercial_invoice":
      return <CommercialInvoicePaper />;
    case "packing_list":
      return <PackingListPaper />;
    case "receipt_voucher":
      return <ReceiptVoucherPaper />;
    default:
      return null;
  }
}
