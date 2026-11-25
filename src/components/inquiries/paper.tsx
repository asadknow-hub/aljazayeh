"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { BankDetails } from "@/lib/banks/types";
import type { CompanyLetterhead } from "@/lib/company-settings/types";
import { formatFormDate } from "@/lib/datetime/format";
import type { InquiryStageKey } from "@/lib/inquiries/stages";
import {
  formatMoney,
  paperText,
  stageFieldDisplay,
  stageFields,
  type InquiryTotals,
  type StageField,
  type StepTemplate,
} from "@/lib/inquiries/stage-forms";
import type {
  InquiryLineItemInput,
  InquiryView,
  StageTables,
} from "@/lib/inquiries/types";

/**
 * Everything a paper needs: the company's own details, the inquiry with all
 * its steps, and the step being shown with its answers. While a step is
 * being filled in, the answers are what is typed right now, so the paper is
 * a live preview of what will be printed. `template` is the company's own
 * version of the step's papers: their wording and which details they carry.
 */
type PaperState = {
  company: CompanyLetterhead;
  inquiry: InquiryView;
  stage: InquiryStageKey;
  template: StepTemplate;
  values: Record<string, string>;
  items: InquiryLineItemInput[];
  tables: StageTables;
  totals: InquiryTotals;
  /** The bank account the paper prints; none if the company chose none. */
  bank: BankDetails | null;
};

const PaperContext = createContext<PaperState | null>(null);

export function PaperProvider({
  state,
  children,
}: {
  state: PaperState;
  children: ReactNode;
}) {
  return <PaperContext.Provider value={state}>{children}</PaperContext.Provider>;
}

export function usePaper(): PaperState {
  const paper = useContext(PaperContext);
  if (!paper) throw new Error("A paper must be inside a PaperProvider.");
  return paper;
}

/** A value as it is written on paper. */
function writtenValue(field: StageField, value: string): string {
  if (!value) return "";
  if (field.type === "date") return formatFormDate(value);
  if (field.type === "amount") return formatMoney(Number(value));
  return stageFieldDisplay(field, value);
}

/** A line to write on by hand once the paper is printed. */
export function Blank({ className = "w-40" }: { className?: string }) {
  return (
    <span
      className={`inline-block border-b border-slate-500 align-baseline ${className}`}
    >
      &nbsp;
    </span>
  );
}

/** One of the step's answers, written where it belongs on the paper. */
export function Fill({
  name,
  blank,
}: {
  name: string;
  /** Left empty, show a line this wide to write on by hand. */
  blank?: string;
}) {
  const paper = usePaper();
  // A detail the company switched off is not written, even if an earlier
  // answer to it is still on record.
  const field = stageFields(paper.stage, paper.template).find(
    (item) => item.key === name,
  );
  const value = field ? (paper.values[name] ?? "") : "";
  if (!value) return blank ? <Blank className={blank} /> : null;
  return (
    <span className="whitespace-pre-wrap">{writtenValue(field!, value)}</span>
  );
}

/**
 * Whether the step asks for a detail. Where a paper has a line of its own
 * for a detail, the line is left out when the company switched it off.
 */
export function useAsked(): (name: string) => boolean {
  const paper = usePaper();
  const asked = new Set(
    stageFields(paper.stage, paper.template).map((field) => field.key),
  );
  return (name) => asked.has(name);
}

/** The wording of one of the step's papers, as the company set it. */
export function usePaperTexts(document: string): (key: string) => string {
  const paper = usePaper();
  return (key) =>
    paperText(paper.stage, document, key, paper.template).replaceAll(
      "{company}",
      paper.company.name,
    );
}

/* ------------------------------ paper pieces ------------------------------ */

/**
 * The sheet itself: white, A4 wide on screen, the whole page when printed.
 * On a screen too narrow for a paper it keeps its shape and is moved
 * sideways with a finger, rather than squeezing its tables off the screen.
 */
export function PaperSheet({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-full overflow-x-auto print:overflow-visible">
      <div className="paper print-exact mx-auto w-full max-w-[210mm] min-w-[36rem] border border-slate-300 bg-white px-8 py-8 shadow-sm print:max-w-none print:min-w-0 print:border-0 print:p-0 print:shadow-none">
        {children}
      </div>
    </div>
  );
}

/** The company's details at the top of every customer document. */
export function CompanyHeading() {
  const { company } = usePaper();
  const line = "leading-[1.45]";
  return (
    <div className="flex items-start justify-between gap-3 text-[11.5px]">
      <div className={`min-w-0 flex-1 ${line}`}>
        <p className="text-[15px] font-bold uppercase">{company.name}</p>
        {company.telephone ? <p>Tel: {company.telephone}</p> : null}
        {company.email ? <p>Email: {company.email}</p> : null}
        {company.address ? <p>Address: {company.address}</p> : null}
        {company.poBox ? <p>{company.poBox}</p> : null}
      </div>
      {company.logoImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing to optimise
        <img src={company.logoImage} alt="" className="h-20 w-auto shrink-0" />
      ) : null}
      <div dir="rtl" className={`min-w-0 flex-1 text-right ${line}`}>
        {company.nameArabic ? (
          <p className="text-[15px] font-bold">{company.nameArabic}</p>
        ) : null}
        {company.telephone ? (
          <p>
            هاتف: <span dir="ltr">{company.telephone}</span>
          </p>
        ) : null}
        {company.email ? (
          <p>
            البريد: <span dir="ltr">{company.email}</span>
          </p>
        ) : null}
        {company.addressArabic ? <p>العنوان: {company.addressArabic}</p> : null}
      </div>
    </div>
  );
}

export function PaperTitle({
  children,
  underlined = false,
}: {
  children: ReactNode;
  underlined?: boolean;
}) {
  return (
    <h3
      className={[
        "mt-5 mb-4 text-center text-[19px] font-bold tracking-wide uppercase",
        underlined ? "underline underline-offset-4" : "",
      ].join(" ")}
      style={{ fontFamily: "inherit" }}
    >
      {children}
    </h3>
  );
}

/** A shaded box of details, as on the customer documents. */
export function Shaded({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-[#e6eaf2] px-3 py-2.5 ${className}`}>{children}</div>
  );
}

/** "Label: value" on one line. */
export function Line({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <p className="leading-[1.7]">
      <span className="font-semibold">{label}</span> {children}
    </p>
  );
}

/** "Label: answer" for one of the step's details; left out if it is not asked. */
export function FieldLine({ label, name }: { label: string; name: string }) {
  const asked = useAsked();
  if (!asked(name)) return null;
  return (
    <Line label={label}>
      <Fill name={name} />
    </Line>
  );
}

export const darkHead =
  "bg-[#3a3a3f] px-2 py-2 text-left text-[11.5px] font-semibold text-white";
/** A dark band across the paper that names the part under it. */
export const darkBar =
  "bg-[#3a3a3f] px-2 py-2 text-center text-[12.5px] font-semibold uppercase text-white";
export const cell = "border border-slate-300 px-2 py-1.5 align-top";

/** Blank rows under the items, so a short list still looks like the form. */
export function BlankRows({
  have,
  columns,
  atLeast = 4,
}: {
  have: number;
  columns: number;
  atLeast?: number;
}) {
  return (
    <>
      {Array.from({ length: Math.max(0, atLeast - have) }, (_, row) => (
        <tr key={`blank-${row}`}>
          {Array.from({ length: columns }, (_, column) => (
            <td key={column} className={`${cell} h-8`} />
          ))}
        </tr>
      ))}
    </>
  );
}

/** A box to sign or stamp in, with what goes there written inside. */
export function SignatureBox({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 flex h-16 items-center justify-center border border-dashed border-slate-400 text-[11px] text-slate-500">
      {children}
    </div>
  );
}
