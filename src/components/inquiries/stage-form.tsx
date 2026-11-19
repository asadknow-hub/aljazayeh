"use client";

import { useState, type ReactNode } from "react";
import { DocumentIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { formatFormDate } from "@/lib/datetime/format";
import type { InquiryStageKey } from "@/lib/inquiries/stages";
import {
  fieldShown,
  formatMoney,
  STAGE_DEFINITIONS,
  STEP_FORM,
  stageFieldDisplay,
  type StageField,
} from "@/lib/inquiries/stage-forms";
import type { InquiryLineItemInput, StageTables } from "@/lib/inquiries/types";

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

/**
 * The questions asked in one place (the step's own form, or one of its
 * papers), leaving out the ones the other answers make irrelevant.
 */
function fieldsOn(
  stage: InquiryStageKey,
  place: string,
  values: Record<string, string>,
): StageField[] {
  return STAGE_DEFINITIONS[stage].fields.filter(
    (field) => field.on === place && fieldShown(field, values),
  );
}

export function hasFields(stage: InquiryStageKey, place: string): boolean {
  return STAGE_DEFINITIONS[stage].fields.some((field) => field.on === place);
}

/** What a form needs to take in and show uploaded files. */
export type FileHandling = {
  /** The name of an uploaded file, by its id. */
  nameOf: (id: string) => string;
  /** Where an uploaded file can be opened. */
  hrefOf: (id: string) => string;
  /** Upload a file; gives its id, or nothing if it was refused. */
  upload: (file: File) => Promise<string | null>;
};

/** Choose, see and replace an uploaded file. */
function FileInput({
  id,
  value,
  onChange,
  disabled,
  invalid,
  files,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  invalid: boolean;
  files: FileHandling;
}) {
  const [uploading, setUploading] = useState(false);

  return (
    <div
      className={[
        "flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-3 py-3",
        invalid ? "border-red-500 bg-red-50" : "border-slate-300 bg-slate-50",
      ].join(" ")}
    >
      {value ? (
        <a
          href={files.hrefOf(value)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <DocumentIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{files.nameOf(value)}</span>
        </a>
      ) : (
        <span className="text-sm text-slate-600">No file chosen yet.</span>
      )}
      <label
        className={[
          "btn btn-sm",
          value ? "btn-secondary" : "btn-primary",
          disabled || uploading ? "pointer-events-none opacity-50" : "",
        ].join(" ")}
      >
        {uploading ? "Uploading…" : value ? "Replace" : "Choose file"}
        <input
          id={id}
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          disabled={disabled || uploading}
          className="sr-only"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setUploading(true);
            const uploaded = await files.upload(file);
            setUploading(false);
            if (uploaded) onChange(uploaded);
          }}
        />
      </label>
    </div>
  );
}

const SHORT_TYPES = new Set(["date", "time", "amount", "number"]);

function FieldInput({
  field,
  value,
  onChange,
  disabled,
  invalid,
  fullWidth,
  files,
}: {
  field: StageField;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  invalid: boolean;
  fullWidth: boolean;
  files?: FileHandling;
}) {
  const id = fillId(field.key);
  const span = fullWidth ? "col-span-2" : "col-span-2 sm:col-span-1";

  if (field.type === "yesno") {
    return (
      <label
        htmlFor={id}
        className={[
          "col-span-2 flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium",
          value === "yes"
            ? "border-blue-300 bg-primary-soft text-slate-900"
            : "border-slate-200 bg-slate-50 text-slate-800",
          disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
        ].join(" ")}
      >
        <input
          id={id}
          type="checkbox"
          checked={value === "yes"}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked ? "yes" : "")}
          className="h-4 w-4 accent-[var(--color-primary)]"
        />
        {field.label}
      </label>
    );
  }

  const shared = {
    id,
    value,
    disabled,
    "aria-required": field.required,
    "aria-invalid": invalid || undefined,
    className: "field w-full",
  };

  return (
    <div className={`flex flex-col gap-1.5 ${span}`}>
      <label htmlFor={id} className="field-label">
        {field.label}
        {field.required ? (
          <span className="ml-0.5 text-red-600" title="Needed to move on">
            *
          </span>
        ) : null}
      </label>
      {field.type === "file" ? (
        files ? (
          <FileInput
            id={id}
            value={value}
            onChange={onChange}
            disabled={disabled}
            invalid={invalid}
            files={files}
          />
        ) : null
      ) : field.type === "longtext" ? (
        <textarea
          {...shared}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : field.type === "choice" ? (
        <select {...shared} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select…</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...shared}
          type={
            field.type === "date"
              ? "date"
              : field.type === "time"
                ? "time"
                : "text"
          }
          inputMode={
            field.type === "amount" || field.type === "number"
              ? "decimal"
              : undefined
          }
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {invalid ? (
        <p className="text-xs font-medium text-red-700">This is needed.</p>
      ) : null}
    </div>
  );
}

/**
 * The questions of one place, for filling in. In the narrow column beside a
 * paper only short answers (dates, numbers) sit two to a row.
 */
export function StageFields({
  stage,
  place = STEP_FORM,
  values,
  onChange,
  disabled = false,
  invalid,
  narrow = false,
  files,
}: {
  stage: InquiryStageKey;
  place?: string;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  disabled?: boolean;
  /** Questions that still have to be answered, shown in red. */
  invalid?: ReadonlySet<string>;
  narrow?: boolean;
  files?: FileHandling;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
      {fieldsOn(stage, place, values).map((field) => (
        <FieldInput
          key={field.key}
          field={field}
          value={values[field.key] ?? ""}
          disabled={disabled}
          invalid={Boolean(invalid?.has(field.key)) && !values[field.key]}
          fullWidth={
            Boolean(field.wide) || (narrow && !SHORT_TYPES.has(field.type))
          }
          files={files}
          onChange={(value) => onChange({ ...values, [field.key]: value })}
        />
      ))}
    </div>
  );
}

/** The step's own answers, for reading. */
export function StageAnswers({
  stage,
  values,
  files,
}: {
  stage: InquiryStageKey;
  values: Record<string, string>;
  files: Pick<FileHandling, "nameOf" | "hrefOf">;
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {fieldsOn(stage, STEP_FORM, values).map((field) => {
        const value = values[field.key] ?? "";
        const shown =
          field.type === "date" && value
            ? formatFormDate(value)
            : field.type === "amount" && value
              ? `AED ${formatMoney(Number(value))}`
              : stageFieldDisplay(field, value);
        return (
          <div key={field.key} className={field.wide ? "sm:col-span-2" : ""}>
            <dt className="field-label">{field.label}</dt>
            <dd className="mt-0.5 text-sm whitespace-pre-wrap text-slate-900">
              {field.type === "file" && value ? (
                <a
                  href={files.hrefOf(value)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                >
                  <DocumentIcon className="h-4 w-4" />
                  {files.nameOf(value)}
                </a>
              ) : value || field.type === "yesno" ? (
                shown
              ) : (
                "—"
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

const lineAmount = (item: InquiryLineItemInput) =>
  (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);

/**
 * What the customer is asking for, as taken down on the Inquiry: each item
 * with its quantity and price. The quotation is prepared from this list.
 */
export function InquiryItems({
  items,
  onChange,
  disabled = false,
}: {
  items: InquiryLineItemInput[];
  onChange?: (items: InquiryLineItemInput[]) => void;
  disabled?: boolean;
}) {
  const editable = !disabled && Boolean(onChange);
  const total = items.reduce((sum, item) => sum + lineAmount(item), 0);

  function update(index: number, patch: Partial<InquiryLineItemInput>) {
    onChange?.(
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  const cell = "px-2 py-1.5 align-top";
  const input =
    "field w-full !rounded-md !px-2 !py-1.5 disabled:!bg-transparent disabled:!text-slate-800";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">Items</h4>
        {editable ? (
          <button
            type="button"
            onClick={() => onChange?.([...items, emptyLineItem()])}
            className="btn btn-secondary btn-sm"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add item
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="w-8 px-2 py-2">#</th>
              <th className="px-2 py-2">Description</th>
              <th className="w-24 px-2 py-2">Qty</th>
              <th className="w-32 px-2 py-2">Price (AED)</th>
              <th className="w-28 px-2 py-2 text-right">Amount</th>
              {editable ? <th className="w-9 px-2 py-2" /> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-sm text-slate-500">
                  No items yet.
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id ?? `new-${index}`}>
                  <td className={`${cell} pt-3 text-slate-500`}>{index + 1}</td>
                  <td className={cell}>
                    <input
                      aria-label={`Item ${index + 1} description`}
                      className={input}
                      disabled={!editable}
                      value={item.description}
                      onChange={(event) =>
                        update(index, { description: event.target.value })
                      }
                    />
                  </td>
                  <td className={cell}>
                    <input
                      aria-label={`Item ${index + 1} quantity`}
                      inputMode="decimal"
                      className={input}
                      disabled={!editable}
                      value={item.quantity}
                      onChange={(event) =>
                        update(index, { quantity: event.target.value })
                      }
                    />
                  </td>
                  <td className={cell}>
                    <input
                      aria-label={`Item ${index + 1} price`}
                      inputMode="decimal"
                      placeholder="0.00"
                      className={input}
                      disabled={!editable}
                      value={item.unitPrice}
                      onChange={(event) =>
                        update(index, { unitPrice: event.target.value })
                      }
                    />
                  </td>
                  <td
                    className={`${cell} pt-3 text-right tabular-nums text-slate-900`}
                  >
                    {formatMoney(lineAmount(item))}
                  </td>
                  {editable ? (
                    <td className={`${cell} pt-2`}>
                      <button
                        type="button"
                        aria-label={`Remove item ${index + 1}`}
                        onClick={() =>
                          onChange?.(items.filter((_, i) => i !== index))
                        }
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
          {items.length > 0 ? (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                <td colSpan={4} className="px-2 py-2 text-right">
                  Total before VAT (AED)
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatMoney(total)}
                </td>
                {editable ? <td /> : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

/* --------------------- the form beside a paper: its lists -------------------- */

/** A small labelled box in the column beside a paper. */
function SmallInput({
  id,
  label,
  row,
  value,
  onChange,
  disabled,
  invalid = false,
  numeric = false,
  className = "",
}: {
  id?: string;
  label: string;
  /** Which row it belongs to, read out with the label: "Item 2". */
  row: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  invalid?: boolean;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="field-label">{label}</span>
      <input
        id={id}
        aria-label={`${row} ${label.toLowerCase()}`}
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        inputMode={numeric ? "decimal" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="field w-full !px-2 !py-1.5"
      />
    </label>
  );
}

function RowCard({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {onRemove ? (
          <button
            type="button"
            aria-label={`Remove ${title}`}
            onClick={onRemove}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <TrashIcon />
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-6 gap-2">{children}</div>
    </div>
  );
}

function AddButton({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="btn btn-secondary btn-sm">
      <PlusIcon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

/**
 * The job's items as far as the paper on screen is concerned: the whole list
 * on the quotation, the delivered quantities on the delivery note, and on any
 * paper the details it writes against each item (a remark, a heat number).
 */
export function ItemsEditor({
  stage,
  document,
  items,
  onChange,
  disabled,
  invalid,
}: {
  stage: InquiryStageKey;
  document: string;
  items: InquiryLineItemInput[];
  onChange: (items: InquiryLineItemInput[]) => void;
  disabled: boolean;
  invalid: ReadonlySet<string>;
}) {
  const definition = STAGE_DEFINITIONS[stage];
  const details = definition.itemDetails.filter((detail) =>
    detail.on.includes(document),
  );
  const listOpen = definition.items === "priced";
  const delivery = definition.items === "delivery";
  if (!listOpen && !delivery && details.length === 0) return null;

  const update = (index: number, patch: Partial<InquiryLineItemInput>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div className="flex flex-col gap-2.5">
      <h4 className="text-sm font-semibold text-slate-800">Items</h4>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No items yet.</p>
      ) : null}
      {items.map((item, index) => (
        <RowCard
          key={item.id ?? `new-${index}`}
          title={
            listOpen
              ? `Item ${index + 1}`
              : `${index + 1}. ${item.description} · ${item.quantity} ${item.unit}`
          }
          onRemove={
            listOpen && !disabled
              ? () => onChange(items.filter((_, i) => i !== index))
              : undefined
          }
        >
          {listOpen ? (
            <>
              <SmallInput
                row={`Item ${index + 1}`}
                label="Description"
                value={item.description}
                disabled={disabled}
                className="col-span-6"
                onChange={(description) => update(index, { description })}
              />
              <SmallInput
                row={`Item ${index + 1}`}
                label="Unit"
                value={item.unit}
                disabled={disabled}
                className="col-span-2"
                onChange={(unit) => update(index, { unit })}
              />
              <SmallInput
                row={`Item ${index + 1}`}
                label="Qty"
                value={item.quantity}
                disabled={disabled}
                numeric
                className="col-span-2"
                onChange={(quantity) => update(index, { quantity })}
              />
              <SmallInput
                row={`Item ${index + 1}`}
                id={fillId(itemFillKey(index, "unitPrice"))}
                label="Unit price"
                value={item.unitPrice}
                disabled={disabled}
                numeric
                invalid={
                  invalid.has(itemFillKey(index, "unitPrice")) &&
                  !Number(item.unitPrice)
                }
                className="col-span-2"
                onChange={(unitPrice) => update(index, { unitPrice })}
              />
            </>
          ) : null}
          {delivery ? (
            <SmallInput
                row={`Item ${index + 1}`}
              id={fillId(itemFillKey(index, "deliveredQuantity"))}
              label="Delivered qty"
              value={item.deliveredQuantity}
              disabled={disabled}
              numeric
              invalid={
                invalid.has(itemFillKey(index, "deliveredQuantity")) &&
                !item.deliveredQuantity
              }
              className="col-span-2"
              onChange={(deliveredQuantity) =>
                update(index, { deliveredQuantity })
              }
            />
          ) : null}
          {details.map((detail) => (
            <SmallInput
                row={`Item ${index + 1}`}
              key={detail.key}
              label={detail.label}
              value={item.details[detail.key] ?? ""}
              disabled={disabled}
              className={
                details.length + (delivery ? 1 : 0) === 1
                  ? "col-span-6"
                  : delivery
                    ? "col-span-4"
                    : "col-span-3"
              }
              onChange={(value) =>
                update(index, {
                  details: { ...item.details, [detail.key]: value },
                })
              }
            />
          ))}
        </RowCard>
      ))}
      {listOpen && !disabled ? (
        <div>
          <AddButton onClick={() => onChange([...items, emptyLineItem()])}>
            Add item
          </AddButton>
        </div>
      ) : null}
    </div>
  );
}

/** The lists a paper keeps of its own: purchase order lines, packages. */
export function TablesEditor({
  stage,
  document,
  tables,
  onChange,
  disabled,
}: {
  stage: InquiryStageKey;
  document: string;
  tables: StageTables;
  onChange: (name: string, rows: Record<string, string>[]) => void;
  disabled: boolean;
}) {
  const lists = Object.entries(STAGE_DEFINITIONS[stage].tables).filter(
    ([, table]) => table.on === document,
  );
  if (lists.length === 0) return null;

  return (
    <>
      {lists.map(([name, table]) => {
        const rows = tables[name] ?? [];
        return (
          <div key={name} className="flex flex-col gap-2.5">
            <h4 className="text-sm font-semibold text-slate-800">
              {table.title}
            </h4>
            {rows.map((row, index) => (
              <RowCard
                key={index}
                title={`${table.rowLabel} ${index + 1}`}
                onRemove={
                  disabled
                    ? undefined
                    : () =>
                        onChange(
                          name,
                          rows.filter((_, i) => i !== index),
                        )
                }
              >
                {table.columns.map((column, columnIndex) => (
                  <SmallInput
                    row={`${table.rowLabel} ${index + 1}`}
                    key={column.key}
                    label={column.label}
                    value={row[column.key] ?? ""}
                    disabled={disabled}
                    numeric={column.numeric}
                    className={columnIndex === 0 ? "col-span-6" : "col-span-3"}
                    onChange={(value) =>
                      onChange(
                        name,
                        rows.map((item, i) =>
                          i === index ? { ...item, [column.key]: value } : item,
                        ),
                      )
                    }
                  />
                ))}
              </RowCard>
            ))}
            {disabled ? null : (
              <div>
                <AddButton onClick={() => onChange(name, [...rows, {}])}>
                  {`Add ${table.rowLabel.toLowerCase()}`}
                </AddButton>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
