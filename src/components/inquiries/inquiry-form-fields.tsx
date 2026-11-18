"use client";

import type { ReactNode } from "react";
import type { InquiryCreateInput, InquiryLineItemInput } from "@/lib/inquiries/types";

type InquiryFormFieldsProps = {
  form: InquiryCreateInput;
  onChange: (next: InquiryCreateInput) => void;
  disabled?: boolean;
  commentsSlot?: ReactNode;
};

function emptyLine(): InquiryLineItemInput {
  return { description: "", quantity: "1", unitPrice: "0" };
}

export function InquiryFormFields({
  form,
  onChange,
  disabled = false,
  commentsSlot,
}: InquiryFormFieldsProps) {
  const total = form.lineItems.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  function updateLine(index: number, patch: Partial<InquiryLineItemInput>) {
    if (disabled) return;
    onChange({
      ...form,
      lineItems: form.lineItems.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    });
  }

  function removeLine(index: number) {
    if (disabled) return;
    onChange({
      ...form,
      lineItems: form.lineItems.filter((_, i) => i !== index),
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-[12px] font-medium text-zinc-700">Name</span>
        <input
          required
          disabled={disabled}
          value={form.customerName}
          onChange={(event) =>
            onChange({ ...form, customerName: event.target.value })
          }
          className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-zinc-700">Contact</span>
        <input
          disabled={disabled}
          value={form.contact}
          onChange={(event) =>
            onChange({ ...form, contact: event.target.value })
          }
          className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-zinc-700">
          Delivery expected by
        </span>
        <input
          type="date"
          disabled={disabled}
          value={form.deliveryExpectedOn}
          onChange={(event) =>
            onChange({ ...form, deliveryExpectedOn: event.target.value })
          }
          className="border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-header disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500"
        />
      </label>

      <div className="sm:col-span-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-medium text-zinc-700">
            Quoted items
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onChange({
                ...form,
                lineItems: [...form.lineItems, emptyLine()],
              })
            }
            className="border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Add item
          </button>
        </div>
        <div className="space-y-2 border border-zinc-200 p-2">
          {form.lineItems.length === 0 ? (
            <p className="px-1 py-2 text-sm text-zinc-500">No items yet.</p>
          ) : (
            form.lineItems.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_5rem_6rem_auto]"
              >
                <input
                  placeholder="Description"
                  disabled={disabled}
                  value={item.description}
                  onChange={(event) =>
                    updateLine(index, { description: event.target.value })
                  }
                  className="border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-header disabled:cursor-not-allowed disabled:bg-zinc-50"
                />
                <input
                  placeholder="Qty"
                  disabled={disabled}
                  value={item.quantity}
                  onChange={(event) =>
                    updateLine(index, { quantity: event.target.value })
                  }
                  className="border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-header disabled:cursor-not-allowed disabled:bg-zinc-50"
                />
                <input
                  placeholder="Price"
                  disabled={disabled}
                  value={item.unitPrice}
                  onChange={(event) =>
                    updateLine(index, { unitPrice: event.target.value })
                  }
                  className="border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-header disabled:cursor-not-allowed disabled:bg-zinc-50"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeLine(index)}
                  className="border border-zinc-300 px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
        <p className="mt-2 text-sm font-medium text-zinc-800">
          Total:{" "}
          {total.toLocaleString("en-AE", {
            style: "currency",
            currency: "AED",
          })}
        </p>
      </div>

      {commentsSlot ? (
        <div className="sm:col-span-2">{commentsSlot}</div>
      ) : null}
    </div>
  );
}

export function emptyInquiryForm(): InquiryCreateInput {
  return {
    customerName: "",
    contact: "",
    deliveryExpectedOn: "",
    notes: "",
    lineItems: [emptyLine()],
  };
}
