"use client";

import { Fragment } from "react";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";
import { formatFormDate } from "@/lib/datetime/format";
import type { InquiryStageKey } from "@/lib/inquiries/stages";
import {
  formatMoney,
  STAGE_DEFINITIONS,
  stageFieldDisplay,
  type InquiryTotals,
  type StageField,
  type StageItemsMode,
} from "@/lib/inquiries/stage-forms";
import type { InquiryLineItemInput } from "@/lib/inquiries/types";

/** Fields in the order they are asked, with a heading where a part starts. */
function groupedFields(stage: InquiryStageKey) {
  let lastGroup: string | undefined;
  return STAGE_DEFINITIONS[stage].fields.map((field) => {
    const heading = field.group !== lastGroup ? field.group : undefined;
    lastGroup = field.group;
    return { field, heading };
  });
}

function GroupHeading({ children }: { children: string }) {
  return (
    <h4 className="mt-2 border-b border-slate-200 pb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:col-span-2">
      {children}
    </h4>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: StageField;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const id = `stage-field-${field.key}`;

  if (field.type === "yesno") {
    return (
      <label
        htmlFor={id}
        className={[
          "flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800",
          disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
          field.wide ? "sm:col-span-2" : "",
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
    className: "field w-full",
  };

  return (
    <div
      className={[
        "flex flex-col gap-1.5",
        field.wide ? "sm:col-span-2" : "",
      ].join(" ")}
    >
      <label htmlFor={id} className="field-label">
        {field.label}
        {field.required ? (
          <span className="ml-0.5 text-red-600" title="Needed to move on">
            *
          </span>
        ) : null}
      </label>
      {field.type === "longtext" ? (
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
          type={field.type === "date" ? "date" : "text"}
          inputMode={
            field.type === "amount" || field.type === "number"
              ? "decimal"
              : undefined
          }
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

/** The questions of one step, for filling in. */
export function StageFields({
  stage,
  values,
  onChange,
  disabled = false,
}: {
  stage: InquiryStageKey;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
      {groupedFields(stage).map(({ field, heading }) => (
        <Fragment key={field.key}>
          {heading ? <GroupHeading>{heading}</GroupHeading> : null}
          <FieldInput
            field={field}
            value={values[field.key] ?? ""}
            disabled={disabled}
            onChange={(value) => onChange({ ...values, [field.key]: value })}
          />
        </Fragment>
      ))}
    </div>
  );
}

/** The answers of one step, for reading. */
export function StageAnswers({
  stage,
  values,
}: {
  stage: InquiryStageKey;
  values: Record<string, string>;
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {groupedFields(stage).map(({ field, heading }) => {
        const value = values[field.key] ?? "";
        const shown =
          field.type === "date" && value
            ? formatFormDate(value)
            : field.type === "amount" && value
              ? `AED ${formatMoney(Number(value))}`
              : stageFieldDisplay(field, value);
        return (
          <Fragment key={field.key}>
            {heading ? <GroupHeading>{heading}</GroupHeading> : null}
            <div className={field.wide ? "sm:col-span-2" : ""}>
              <dt className="field-label">{field.label}</dt>
              <dd className="mt-0.5 text-sm whitespace-pre-wrap text-slate-900">
                {value || field.type === "yesno" ? shown : "—"}
              </dd>
            </div>
          </Fragment>
        );
      })}
    </dl>
  );
}

export function emptyLineItem(): InquiryLineItemInput {
  return {
    description: "",
    quantity: "1",
    unit: "Nos",
    unitPrice: "",
    deliveredQuantity: "",
  };
}

const lineAmount = (item: InquiryLineItemInput) =>
  (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);

/**
 * The job's items, shown the way the step uses them: listed on the Inquiry,
 * priced on the Quotation, ticked off on the Delivery Note, and read-only
 * everywhere else.
 */
export function StageItems({
  mode,
  items,
  onChange,
  disabled = false,
  totals,
}: {
  mode: StageItemsMode;
  items: InquiryLineItemInput[];
  onChange?: (items: InquiryLineItemInput[]) => void;
  disabled?: boolean;
  totals?: InquiryTotals;
}) {
  if (mode === "none") return totals ? <TotalsBox totals={totals} /> : null;

  const editable = !disabled && Boolean(onChange);
  const listEditable = editable && (mode === "scope" || mode === "priced");
  const showPrices = mode === "priced" || mode === "summary";
  const showDelivered =
    mode === "delivery" ||
    (mode === "summary" && items.some((item) => item.deliveredQuantity));

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
        <h4 className="text-sm font-semibold text-slate-800">
          {mode === "scope"
            ? "What is needed"
            : mode === "delivery"
              ? "Items delivered"
              : "Items"}
        </h4>
        {listEditable ? (
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
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="w-8 px-2 py-2">#</th>
              <th className="px-2 py-2">Description</th>
              <th className="w-20 px-2 py-2">
                {mode === "delivery" ? "Ordered" : "Qty"}
              </th>
              <th className="w-20 px-2 py-2">Unit</th>
              {showPrices ? (
                <>
                  <th className="w-28 px-2 py-2">Unit price</th>
                  <th className="w-28 px-2 py-2 text-right">Amount</th>
                </>
              ) : null}
              {showDelivered ? (
                <th className="w-24 px-2 py-2">Delivered</th>
              ) : null}
              {listEditable ? <th className="w-9 px-2 py-2" /> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-sm text-slate-500">
                  No items yet.
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                const short =
                  item.deliveredQuantity !== "" &&
                  Number(item.deliveredQuantity) < Number(item.quantity);
                return (
                  <tr key={item.id ?? `new-${index}`}>
                    <td className={`${cell} pt-3 text-slate-500`}>
                      {index + 1}
                    </td>
                    <td className={cell}>
                      <input
                        aria-label={`Item ${index + 1} description`}
                        className={input}
                        disabled={!listEditable}
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
                        disabled={!listEditable}
                        value={item.quantity}
                        onChange={(event) =>
                          update(index, { quantity: event.target.value })
                        }
                      />
                    </td>
                    <td className={cell}>
                      <input
                        aria-label={`Item ${index + 1} unit`}
                        className={input}
                        disabled={!listEditable}
                        value={item.unit}
                        onChange={(event) =>
                          update(index, { unit: event.target.value })
                        }
                      />
                    </td>
                    {showPrices ? (
                      <>
                        <td className={cell}>
                          <input
                            aria-label={`Item ${index + 1} unit price`}
                            inputMode="decimal"
                            placeholder="0.00"
                            className={input}
                            disabled={!editable || mode !== "priced"}
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
                      </>
                    ) : null}
                    {showDelivered ? (
                      <td className={cell}>
                        <input
                          aria-label={`Item ${index + 1} delivered quantity`}
                          inputMode="decimal"
                          className={[
                            input,
                            short ? "!border-amber-400 !bg-amber-50" : "",
                          ].join(" ")}
                          disabled={!editable || mode !== "delivery"}
                          value={item.deliveredQuantity}
                          onChange={(event) =>
                            update(index, {
                              deliveredQuantity: event.target.value,
                            })
                          }
                        />
                      </td>
                    ) : null}
                    {listEditable ? (
                      <td className={`${cell} pt-2`}>
                        <button
                          type="button"
                          aria-label={`Remove item ${index + 1}`}
                          onClick={() =>
                            onChange?.(items.filter((_, i) => i !== index))
                          }
                          className="cursor-pointer rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showPrices && totals ? <TotalsBox totals={totals} /> : null}
    </div>
  );
}

function TotalsBox({ totals }: { totals: InquiryTotals }) {
  const row = "flex items-center justify-between gap-6 py-1";
  return (
    <div className="mt-3 ml-auto w-full max-w-xs rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm tabular-nums">
      <div className={row}>
        <span className="text-slate-600">Subtotal</span>
        <span>{formatMoney(totals.subtotal)}</span>
      </div>
      {totals.discount > 0 ? (
        <div className={row}>
          <span className="text-slate-600">Discount</span>
          <span>− {formatMoney(totals.discount)}</span>
        </div>
      ) : null}
      <div className={row}>
        <span className="text-slate-600">VAT {totals.vatPercent}%</span>
        <span>{formatMoney(totals.vat)}</span>
      </div>
      <div
        className={`${row} mt-1 border-t border-slate-300 pt-2 font-semibold text-slate-900`}
      >
        <span>Total (AED)</span>
        <span>{formatMoney(totals.total)}</span>
      </div>
    </div>
  );
}
