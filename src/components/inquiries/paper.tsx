"use client";

import { createContext, useContext, type ReactNode } from "react";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";
import type { CompanyLetterhead } from "@/lib/company-settings/types";
import { formatFormDate } from "@/lib/datetime/format";
import type { InquiryStageKey } from "@/lib/inquiries/stages";
import {
  formatMoney,
  STAGE_DEFINITIONS,
  stageFieldDisplay,
  type InquiryTotals,
  type StageField,
} from "@/lib/inquiries/stage-forms";
import type {
  InquiryLineItemInput,
  InquiryView,
  StageTables,
} from "@/lib/inquiries/types";

/**
 * Everything a paper needs: the company's own details, the inquiry with all
 * its steps, and the step being shown with what is typed into it. Where the
 * person may write, the paper shows a place to type; everything else is
 * filled in from the earlier steps.
 */
type PaperState = {
  company: CompanyLetterhead;
  inquiry: InquiryView;
  stage: InquiryStageKey;
  editable: boolean;
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
  items: InquiryLineItemInput[];
  setItems: (items: InquiryLineItemInput[]) => void;
  tables: StageTables;
  setTable: (name: string, rows: Record<string, string>[]) => void;
  totals: InquiryTotals;
  /** Places that still have to be filled in, shown in red. */
  invalid: ReadonlySet<string>;
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

/** The id of the place where something is typed, so it can be focused. */
export const fillId = (key: string) => `fill-${key}`;
export const itemFillKey = (index: number, field: string) =>
  `item-${index}-${field}`;

export function emptyLineItem(): InquiryLineItemInput {
  return {
    description: "",
    quantity: "1",
    unit: "Nos",
    unitPrice: "",
    deliveredQuantity: "",
    details: {},
  };
}

/** A value as it is written on paper. */
function writtenValue(field: StageField, value: string): string {
  if (!value) return "";
  if (field.type === "date") return formatFormDate(value);
  if (field.type === "amount") return formatMoney(Number(value));
  return stageFieldDisplay(field, value);
}

/** Typed text with its printed twin: the box on screen, plain text on paper. */
function Typed({
  id,
  label,
  value,
  shown,
  onChange,
  invalid,
  className = "",
  type = "text",
  numeric = false,
  multiline = false,
  options,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  shown: string;
  onChange: (value: string) => void;
  invalid: boolean;
  className?: string;
  type?: string;
  numeric?: boolean;
  multiline?: boolean;
  options?: readonly { value: string; label: string }[];
  placeholder?: string;
}) {
  const shared = {
    id,
    "aria-label": label,
    "aria-invalid": invalid || undefined,
    title: label,
    value,
    className: `paper-fill ${className}`,
  };
  return (
    <>
      {multiline ? (
        <textarea
          {...shared}
          rows={3}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : options ? (
        <select {...shared} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select…</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...shared}
          type={type}
          inputMode={numeric ? "decimal" : undefined}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <span className="hidden whitespace-pre-wrap print:inline">{shown}</span>
    </>
  );
}

/** One of the step's answers, written where it belongs on the paper. */
export function Fill({
  name,
  className,
  placeholder,
  blank,
}: {
  name: string;
  className?: string;
  placeholder?: string;
  /** Left empty, print a line this wide to write on by hand. */
  blank?: string;
}) {
  const paper = usePaper();
  const field = STAGE_DEFINITIONS[paper.stage].fields.find(
    (item) => item.key === name,
  );
  if (!field) return null;

  const value = paper.values[name] ?? "";
  const shown = writtenValue(field, value);
  const handwritten = blank && !value ? <Blank className={blank} /> : null;
  if (!paper.editable) {
    return handwritten ?? <span className="whitespace-pre-wrap">{shown}</span>;
  }

  return (
    <>
      {handwritten ? (
        <span className="hidden print:inline">{handwritten}</span>
      ) : null}
      <Typed
      id={fillId(name)}
      label={field.label}
      value={value}
      shown={shown}
      invalid={paper.invalid.has(name) && !value}
      onChange={(next) => paper.setValue(name, next)}
      className={className}
      placeholder={placeholder}
      type={
        field.type === "date" ? "date" : field.type === "time" ? "time" : "text"
      }
      numeric={field.type === "amount" || field.type === "number"}
      multiline={field.type === "longtext"}
      options={field.type === "choice" ? field.options : undefined}
      />
    </>
  );
}

type ItemColumn = "description" | "quantity" | "unit" | "unitPrice" | "deliveredQuantity";

/** Whether the step being shown may change this part of an item. */
function itemColumnOpen(stage: InquiryStageKey, column: ItemColumn): boolean {
  const mode = STAGE_DEFINITIONS[stage].items;
  if (column === "deliveredQuantity") return mode === "delivery";
  if (column === "unit") return mode === "priced";
  return mode === "entry" || mode === "priced";
}

/** One part of an item: typed in the steps that own it, plain text elsewhere. */
export function ItemFill({
  index,
  column,
  className,
}: {
  index: number;
  column: ItemColumn;
  className?: string;
}) {
  const paper = usePaper();
  const item = paper.items[index];
  if (!item) return null;

  const value = item[column];
  const shown =
    column === "unitPrice" && value ? formatMoney(Number(value)) : value;
  if (!paper.editable || !itemColumnOpen(paper.stage, column)) {
    return <span className="whitespace-pre-wrap">{shown}</span>;
  }

  const key = itemFillKey(index, column);
  return (
    <Typed
      id={fillId(key)}
      label={`Item ${index + 1} ${column === "unitPrice" ? "price" : column === "deliveredQuantity" ? "delivered quantity" : column}`}
      value={value}
      shown={shown}
      invalid={paper.invalid.has(key) && !Number(value)}
      onChange={(next) =>
        paper.setItems(
          paper.items.map((row, i) =>
            i === index ? { ...row, [column]: next } : row,
          ),
        )
      }
      className={className ?? "w-full"}
      numeric={column !== "description" && column !== "unit"}
    />
  );
}

/** Something a step writes against an item: a remark, a heat number, … */
export function ItemDetailFill({
  index,
  name,
  label,
}: {
  index: number;
  name: string;
  label: string;
}) {
  const paper = usePaper();
  const item = paper.items[index];
  if (!item) return null;

  const value = item.details[name] ?? "";
  if (
    !paper.editable ||
    !STAGE_DEFINITIONS[paper.stage].itemDetails.includes(name)
  ) {
    return <span className="whitespace-pre-wrap">{value}</span>;
  }

  return (
    <Typed
      id={fillId(itemFillKey(index, name))}
      label={`Item ${index + 1} ${label}`}
      value={value}
      shown={value}
      invalid={false}
      onChange={(next) =>
        paper.setItems(
          paper.items.map((row, i) =>
            i === index
              ? { ...row, details: { ...row.details, [name]: next } }
              : row,
          ),
        )
      }
      className="w-full"
    />
  );
}

/** Add and remove items, in the steps where the list itself can change. */
export function ItemListControls({ index }: { index?: number }) {
  const paper = usePaper();
  const mode = STAGE_DEFINITIONS[paper.stage].items;
  if (!paper.editable || (mode !== "entry" && mode !== "priced")) return null;

  if (index === undefined) {
    return (
      <button
        type="button"
        onClick={() => paper.setItems([...paper.items, emptyLineItem()])}
        className="btn btn-secondary btn-sm mt-2 print:hidden"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Add item
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-label={`Remove item ${index + 1}`}
      onClick={() => paper.setItems(paper.items.filter((_, i) => i !== index))}
      className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 print:hidden"
    >
      <TrashIcon className="h-3.5 w-3.5" />
    </button>
  );
}

/** One cell of a list the step keeps of its own (purchase order lines, …). */
export function TableFill({
  table,
  row,
  column,
}: {
  table: string;
  row: number;
  column: string;
}) {
  const paper = usePaper();
  const definition = STAGE_DEFINITIONS[paper.stage].tables[table]?.columns.find(
    (item) => item.key === column,
  );
  const rows = paper.tables[table] ?? [];
  const value = rows[row]?.[column] ?? "";
  const shown =
    definition?.numeric && value ? formatMoney(Number(value)) : value;
  if (!paper.editable || !definition) {
    return <span className="whitespace-pre-wrap">{shown}</span>;
  }

  return (
    <Typed
      id={fillId(`${table}-${row}-${column}`)}
      label={`${definition.label}, row ${row + 1}`}
      value={value}
      shown={shown}
      invalid={false}
      onChange={(next) =>
        paper.setTable(
          table,
          rows.map((item, i) => (i === row ? { ...item, [column]: next } : item)),
        )
      }
      className="w-full"
      numeric={definition.numeric}
    />
  );
}

export function TableRowControls({
  table,
  row,
}: {
  table: string;
  row?: number;
}) {
  const paper = usePaper();
  if (!paper.editable) return null;
  const rows = paper.tables[table] ?? [];

  if (row === undefined) {
    return (
      <button
        type="button"
        onClick={() => paper.setTable(table, [...rows, {}])}
        className="btn btn-secondary btn-sm mt-2 print:hidden"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Add row
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-label={`Remove row ${row + 1}`}
      onClick={() =>
        paper.setTable(
          table,
          rows.filter((_, i) => i !== row),
        )
      }
      className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 print:hidden"
    >
      <TrashIcon className="h-3.5 w-3.5" />
    </button>
  );
}

/* ------------------------------ paper pieces ------------------------------ */

/** The sheet itself: white, A4 wide on screen, the whole page when printed. */
export function PaperSheet({ children }: { children: ReactNode }) {
  return (
    <div className="paper print-exact mx-auto w-full max-w-[210mm] border border-slate-300 bg-white px-8 py-8 shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none">
      {children}
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

/** A document number, or a note that it comes when the step is saved. */
export function DocumentNumber({ value }: { value: string }) {
  return value ? (
    <>{value}</>
  ) : (
    <span className="text-slate-400 print:hidden">given when saved</span>
  );
}

export const darkHead =
  "bg-[#3a3a3f] px-2 py-2 text-left text-[11.5px] font-semibold text-white";
/** A dark band across the paper that names the part under it. */
export const darkBar =
  "bg-[#3a3a3f] px-2 py-2 text-center text-[12.5px] font-semibold uppercase text-white";
export const cell = "border border-slate-300 px-2 py-1.5 align-top";

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

/** Whether the list of items itself can be changed on the paper shown. */
export function useItemListOpen(): boolean {
  const paper = usePaper();
  const mode = STAGE_DEFINITIONS[paper.stage].items;
  return paper.editable && (mode === "entry" || mode === "priced");
}

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

/** A line to sign on, with what goes there written under it. */
export function SignatureBox({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 flex h-16 items-center justify-center border border-dashed border-slate-400 text-[11px] text-slate-500">
      {children}
    </div>
  );
}
