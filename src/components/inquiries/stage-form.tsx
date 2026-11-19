"use client";

import { fillId, itemFillKey, emptyLineItem } from "@/components/inquiries/paper";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";
import { formatFormDate } from "@/lib/datetime/format";
import type { InquiryStageKey } from "@/lib/inquiries/stages";
import {
  formatMoney,
  STAGE_DEFINITIONS,
  STEP_FORM,
  stageFieldDisplay,
  type StageField,
} from "@/lib/inquiries/stage-forms";
import type { InquiryLineItemInput } from "@/lib/inquiries/types";

/** The step's own questions: the ones that are not written on a paper. */
function formFields(stage: InquiryStageKey): StageField[] {
  return STAGE_DEFINITIONS[stage].fields.filter(
    (field) => field.on === STEP_FORM,
  );
}

export function hasFormFields(stage: InquiryStageKey): boolean {
  return formFields(stage).length > 0;
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
  invalid,
}: {
  field: StageField;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  invalid: boolean;
}) {
  const id = fillId(field.key);

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
    "aria-invalid": invalid || undefined,
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
      {invalid ? (
        <p className="text-xs font-medium text-red-700">This is needed.</p>
      ) : null}
    </div>
  );
}

/** The step's own questions, for filling in. */
export function StageFields({
  stage,
  values,
  onChange,
  disabled = false,
  invalid,
}: {
  stage: InquiryStageKey;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  disabled?: boolean;
  /** Questions that still have to be answered, shown in red. */
  invalid?: ReadonlySet<string>;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
      {formFields(stage).map((field) => (
        <FieldInput
          key={field.key}
          field={field}
          value={values[field.key] ?? ""}
          disabled={disabled}
          invalid={Boolean(invalid?.has(field.key)) && !values[field.key]}
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
}: {
  stage: InquiryStageKey;
  values: Record<string, string>;
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {formFields(stage).map((field) => {
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
              {value || field.type === "yesno" ? shown : "—"}
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
  invalid,
}: {
  items: InquiryLineItemInput[];
  onChange?: (items: InquiryLineItemInput[]) => void;
  disabled?: boolean;
  invalid?: ReadonlySet<string>;
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
                      id={fillId(itemFillKey(index, "description"))}
                      aria-label={`Item ${index + 1} description`}
                      aria-invalid={
                        (invalid?.has(itemFillKey(index, "description")) &&
                          !item.description) ||
                        undefined
                      }
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
