import type { CatalogEntry } from "@/lib/company-docs/catalog";
import { UserError } from "@/lib/errors";
import {
  canSetPrefill,
  type DocumentSettings,
} from "@/lib/inquiries/stage-forms";

const MAX_TEXT_LENGTH = 2000;
const CODE = /^[A-Z0-9]{2,6}$/;

/** What the Company Docs screen sends: everything, changed or not. */
export type DocumentSettingsInput = {
  code: string;
  texts: Record<string, string>;
  fields: Record<
    string,
    { asked: boolean; required: boolean; prefill: string }
  >;
};

/** A text as it is kept: no stray spaces, and a list without empty lines. */
function tidyText(value: string, kind: string): string {
  const lines = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim());
  return kind === "list" || kind === "paragraph"
    ? lines.filter(Boolean).join("\n")
    : lines.join(" ").trim();
}

/**
 * Check what was entered for one paper and keep only what differs from the
 * built-in version. `takenCodes` are the codes other documents use or have
 * used.
 */
export function normalizeDocumentSettings(
  entry: CatalogEntry,
  raw: DocumentSettingsInput,
  takenCodes: ReadonlySet<string>,
): DocumentSettings {
  const settings: DocumentSettings = {};

  if (entry.counterKey) {
    const code = String(raw?.code ?? "")
      .trim()
      .toUpperCase();
    if (code && code !== entry.counterKey) {
      if (!CODE.test(code)) {
        throw new UserError(
          "The code in the number must be 2 to 6 letters or digits, e.g. QTN.",
        );
      }
      if (takenCodes.has(code)) {
        throw new UserError(
          `The code ${code} belongs to another document. Choose a different one.`,
        );
      }
      settings.code = code;
    }
  }

  const texts: Record<string, string> = {};
  for (const text of entry.texts) {
    const given = raw?.texts?.[text.key];
    if (given === undefined) continue;
    const value = tidyText(given, text.kind);
    if (value.length > MAX_TEXT_LENGTH) {
      throw new UserError(`"${text.label}" is too long.`);
    }
    if (text.kind === "title" && !value) {
      throw new UserError(`"${text.label}" cannot be empty.`);
    }
    if (value !== text.value) texts[text.key] = value;
  }
  if (Object.keys(texts).length > 0) settings.texts = texts;

  const fields: NonNullable<DocumentSettings["fields"]> = {};
  for (const field of entry.fields) {
    const given = raw?.fields?.[field.key];
    if (!given) continue;
    const own: NonNullable<DocumentSettings["fields"]>[string] = {};

    if (!field.locked) {
      if (given.asked === false) own.asked = false;
      // A tick box is never "required": leaving it unticked is an answer.
      const required = field.type !== "yesno" && Boolean(given.required);
      if (given.asked !== false && required !== Boolean(field.required)) {
        own.required = required;
      }
    }

    if (canSetPrefill(field) && given.asked !== false) {
      const prefill = String(given.prefill ?? "").trim();
      if (prefill.length > MAX_TEXT_LENGTH) {
        throw new UserError(
          `The starting value of "${field.label}" is too long.`,
        );
      }
      if (
        prefill &&
        (field.type === "number" || field.type === "amount") &&
        !(Number(prefill) >= 0)
      ) {
        throw new UserError(
          `The starting value of "${field.label}" must be a number.`,
        );
      }
      if (
        prefill &&
        field.type === "choice" &&
        !field.options?.some((option) => option.value === prefill)
      ) {
        throw new UserError(
          `The starting value of "${field.label}" is not one of its choices.`,
        );
      }
      if (prefill !== (field.prefill ?? "")) own.prefill = prefill;
    }

    if (Object.keys(own).length > 0) fields[field.key] = own;
  }
  if (Object.keys(fields).length > 0) settings.fields = fields;

  return settings;
}
