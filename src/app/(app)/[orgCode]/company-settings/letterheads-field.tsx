"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { imageFileToDataUrl } from "@/components/signoffs/signature-pad";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { unwrap, type ActionResult } from "@/lib/actions/result";
import {
  removeLetterheadAction,
  saveLetterheadAction,
} from "@/lib/company-settings/actions";
import type {
  OtherLetterhead,
  OtherLetterheadInput,
} from "@/lib/company-settings/types";

const NEW = "new";
const EMPTY: OtherLetterheadInput = {
  name: "",
  nameArabic: "",
  logoImage: null,
};

/**
 * The other names the company issues papers under, each with its own logo.
 * Saved on its own, apart from the rest of the page.
 */
export function LetterheadsField({
  orgCode,
  companyName,
  initialNames,
}: {
  orgCode: string;
  companyName: string;
  initialNames: OtherLetterhead[];
}) {
  const { showToast } = useToast();
  const [names, setNames] = useState(initialNames);
  /** The name being changed, or NEW while one is being added. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<OtherLetterheadInput>(EMPTY);
  const [removing, setRemoving] = useState<OtherLetterhead | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(id: string, start: OtherLetterheadInput) {
    setError(null);
    setDraft({
      name: start.name,
      nameArabic: start.nameArabic,
      logoImage: start.logoImage,
    });
    setEditing(id);
  }

  async function run(
    work: () => Promise<ActionResult<OtherLetterhead[]>>,
    done: string,
  ) {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      setNames(await unwrap(work()));
      setEditing(null);
      showToast(done);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save.";
      if (editing) setError(message);
      else showToast(message);
    } finally {
      setRemoving(null);
      setPending(false);
    }
  }

  async function chooseLogo(file: File) {
    setError(null);
    try {
      const logoImage = await imageFileToDataUrl(file, 600);
      setDraft((current) => ({ ...current, logoImage }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not read the image.",
      );
    }
  }

  const form = (
    <div className="card flex flex-col gap-3 px-3 py-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Name to print</span>
          <input
            className="field"
            value={draft.name}
            disabled={pending}
            maxLength={120}
            placeholder="Al Jazeyah Workshop LLC"
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">The same name in Arabic</span>
          <input
            dir="rtl"
            className="field"
            value={draft.nameArabic}
            disabled={pending}
            maxLength={120}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                nameArabic: event.target.value,
              }))
            }
          />
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <span className="field-label">Its logo</span>
        <div className="flex flex-wrap items-center gap-3">
          {draft.logoImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing to optimise
            <img src={draft.logoImage} alt="" className="card h-16 p-1" />
          ) : (
            <span className="text-sm text-slate-500">No logo yet.</span>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg"
            aria-label="Logo of this name"
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void chooseLogo(file);
              event.target.value = "";
            }}
            className="text-sm"
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pending}
          onClick={() => setEditing(null)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                saveLetterheadAction(
                  orgCode,
                  editing === NEW ? null : editing,
                  draft,
                ),
              "Name saved",
            )
          }
        >
          {pending ? "Saving…" : "Save this name"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className="field-label">
          Other names the company prints under
        </span>
        <p className="mt-1 text-sm text-slate-600">
          For a company that issues papers under more than one name, such as a
          workshop name and an engineering name. Each quotation, job card and
          invoice then asks which name to print under; {companyName} is the one
          it starts with. The address, telephone and TRN stay the same.
        </p>
      </div>

      {names.map((item) =>
        editing === item.id ? (
          <div key={item.id}>{form}</div>
        ) : (
          <div
            key={item.id}
            className="card flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-3">
              {item.logoImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing to optimise
                <img src={item.logoImage} alt="" className="h-10 w-auto" />
              ) : (
                <span className="chip bg-amber-50 text-amber-800">No logo</span>
              )}
              <div className="min-w-0">
                <p className="font-medium break-words text-slate-900">
                  {item.name}
                </p>
                {item.nameArabic ? (
                  <p dir="rtl" className="text-sm text-slate-600">
                    {item.nameArabic}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={pending}
                onClick={() => open(item.id, item)}
              >
                Change
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={pending}
                onClick={() => setRemoving(item)}
              >
                Remove
              </button>
            </div>
          </div>
        ),
      )}

      {editing === NEW ? (
        form
      ) : (
        <div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={pending}
            onClick={() => open(NEW, EMPTY)}
          >
            Add another name
          </button>
        </div>
      )}

      <ConfirmDeleteDialog
        open={removing !== null}
        title="Stop printing under this name?"
        message={
          removing
            ? `${removing.name} will no longer be offered on new papers. Papers already made under it keep it.`
            : ""
        }
        pending={pending}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing) return;
          const { id, name } = removing;
          void run(
            () => removeLetterheadAction(orgCode, id),
            `${name} removed`,
          );
        }}
      />
    </div>
  );
}
