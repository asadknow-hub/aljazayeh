import { isIsoDate } from "@/lib/datetime/calendar";
import { UserError } from "@/lib/errors";
import {
  FORM_DEFINITIONS,
  type ApprovalFormInput,
  type FormAnswers,
  type FormField,
  type FormType,
} from "@/lib/forms/definitions";

function normalizeValue(field: FormField, raw: unknown, where: string): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    if (field.required) {
      throw new UserError(`${where}: ${field.label} is required.`);
    }
    return "";
  }

  if (field.type === "date") {
    if (!isIsoDate(value)) {
      throw new UserError(`${where}: ${field.label} is not a valid date.`);
    }
    return value;
  }
  if (field.type === "amount" || field.type === "number") {
    const numeric = Number(value);
    if (Number.isNaN(numeric) || numeric < 0) {
      throw new UserError(`${where}: ${field.label} must be a number.`);
    }
    return field.type === "amount" ? numeric.toFixed(2) : String(numeric);
  }
  return value;
}

/** Check what was entered against the form's definition and tidy it. */
export function normalizeFormAnswers(
  type: FormType,
  input: ApprovalFormInput,
): FormAnswers {
  const definition = FORM_DEFINITIONS[type];

  const fields: Record<string, string> = {};
  for (const field of definition.fields) {
    fields[field.key] = normalizeValue(
      field,
      input.fields?.[field.key],
      "Form",
    );
  }

  const lines = (input.lines ?? [])
    // Rows left completely empty are not part of the form.
    .filter((line) =>
      definition.lineColumns.some((column) =>
        `${line?.[column.key] ?? ""}`.trim(),
      ),
    )
    .map((line, index) =>
      Object.fromEntries(
        definition.lineColumns.map((column) => [
          column.key,
          normalizeValue(column, line[column.key], `Line ${index + 1}`),
        ]),
      ),
    );

  if (definition.lineColumns.length > 0 && lines.length === 0) {
    throw new UserError("Add at least one line.");
  }

  return { fields, lines };
}
