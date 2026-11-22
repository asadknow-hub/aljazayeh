/**
 * Company Docs: every paper the system produces, and what a company can
 * change about each.
 *
 * Nothing is listed here by hand. The papers of the inquiry process come
 * from src/lib/inquiries/stage-forms.ts and the signed forms from
 * src/lib/forms/definitions.ts, so a paper added to the system shows up in
 * Company Docs by itself.
 */
import { FORM_DEFINITIONS, FORM_TYPES } from "@/lib/forms/definitions";
import {
  INQUIRY_STAGES,
  isInquiryStageKey,
  type InquiryStageKey,
} from "@/lib/inquiries/stages";
import {
  INQUIRY_COUNTER_KEY,
  STAGE_DEFINITIONS,
  STEP_FORM,
  stageFieldDisplay,
  type PaperText,
  type StageField,
} from "@/lib/inquiries/stage-forms";

/** A paper of the inquiry process, or the details a step asks outside them. */
export type CatalogEntry = {
  stage: InquiryStageKey;
  /** The paper's key, or `STEP_FORM` for the step's own details. */
  document: string;
  name: string;
  kind: "paper" | "details";
  /** The built-in code of the numbers this entry gives out, if it has one. */
  counterKey: string | null;
  /** For a paper that is only prepared for some jobs: when. */
  onlyWhen: { question: string; answer: string } | null;
  texts: readonly PaperText[];
  fields: StageField[];
};

/** The name a company's version of an entry is kept under. */
export function templateKey(stage: string, document: string): string {
  return `${stage}/${document}`;
}

export function parseTemplateKey(
  key: string,
): { stage: InquiryStageKey; document: string } | null {
  const [stage, document, ...rest] = key.split("/");
  if (!stage || !document || rest.length > 0 || !isInquiryStageKey(stage)) {
    return null;
  }
  return { stage, document };
}

function entriesOf(stage: InquiryStageKey): CatalogEntry[] {
  const definition = STAGE_DEFINITIONS[stage];
  const on = (place: string) =>
    definition.fields.filter((field) => field.on === place);
  const entries: CatalogEntry[] = [];

  const ownDetails = on(STEP_FORM);
  if (ownDetails.length > 0) {
    entries.push({
      stage,
      document: STEP_FORM,
      name: definition.formTitle ?? "Details of the step",
      kind: "details",
      counterKey:
        stage === "inquiry"
          ? INQUIRY_COUNTER_KEY
          : (definition.counterKey ?? null),
      onlyWhen: null,
      texts: [],
      fields: ownDetails,
    });
  }

  for (const doc of definition.documents) {
    const asking = doc.enabledWhen
      ? definition.fields.find((field) => field.key === doc.enabledWhen!.field)
      : undefined;
    entries.push({
      stage,
      document: doc.key,
      name: doc.title,
      kind: "paper",
      counterKey: doc.counterKey ?? null,
      onlyWhen:
        doc.enabledWhen && asking
          ? {
              question: asking.label,
              answer: stageFieldDisplay(asking, doc.enabledWhen.value),
            }
          : null,
      texts: doc.texts ?? [],
      fields: on(doc.key),
    });
  }
  return entries;
}

/** Everything the inquiry process has, in the order of its steps. */
export const INQUIRY_CATALOG: readonly CatalogEntry[] = INQUIRY_STAGES.flatMap(
  (stage) => entriesOf(stage.key),
);

export function findCatalogEntry(
  stage: string,
  document: string,
): CatalogEntry | null {
  return (
    INQUIRY_CATALOG.find(
      (entry) => entry.stage === stage && entry.document === document,
    ) ?? null
  );
}

/** The signed forms: the leave request and the forms in src/lib/forms. */
export const SIGNED_FORM_KEYS = ["leave_request", ...FORM_TYPES] as const;
export type SignedFormKey = (typeof SIGNED_FORM_KEYS)[number];

export function isSignedFormKey(value: string): value is SignedFormKey {
  return (SIGNED_FORM_KEYS as readonly string[]).includes(value);
}

/**
 * Codes that already mean something in a document number. A paper cannot
 * take the built-in code of another paper or of a signed form, or two kinds
 * of document would share numbers.
 */
export function builtInCodes(except: CatalogEntry): Set<string> {
  return new Set([
    ...INQUIRY_CATALOG.filter((entry) => entry !== except).flatMap((entry) =>
      entry.counterKey ? [entry.counterKey] : [],
    ),
    ...FORM_TYPES.map((type) => FORM_DEFINITIONS[type].counterKey),
  ]);
}
