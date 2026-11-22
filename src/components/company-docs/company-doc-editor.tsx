"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  countLabel,
  Fact,
  StepFacts,
  whenPrepared,
} from "@/components/company-docs/where-used";
import { DocumentSplit } from "@/components/documents/document-split";
import { PaperProvider } from "@/components/inquiries/paper";
import { StagePaper } from "@/components/inquiries/papers";
import {
  StageFields,
  type FileHandling,
} from "@/components/inquiries/stage-form";
import { usePageTitle } from "@/components/providers/page-title-provider";
import { useToast } from "@/components/providers/toast-provider";
import { AlertIcon, LockIcon, UndoIcon } from "@/components/ui/icons";
import { unwrap, type ActionResult } from "@/lib/actions/result";
import {
  restoreCompanyDocVersionAction,
  saveCompanyDocAction,
} from "@/lib/company-docs/actions";
import {
  findCatalogEntry,
  type CatalogEntry,
} from "@/lib/company-docs/catalog";
import { sampleInquiry } from "@/lib/company-docs/sample";
import type { CompanyDocDetail } from "@/lib/company-docs/types";
import {
  normalizeDocumentSettings,
  type DocumentSettingsInput,
} from "@/lib/company-docs/validate";
import type { CompanyLetterhead } from "@/lib/company-settings/types";
import { formatFriendlyDateTime } from "@/lib/datetime/format";
import {
  canSetPrefill,
  STEP_FORM,
  type DocumentSettings,
  type StageField,
} from "@/lib/inquiries/stage-forms";

const NO_CODES: ReadonlySet<string> = new Set();

/** The sample shows where a file is uploaded, but takes none. */
const NO_UPLOADS: FileHandling = {
  nameOf: () => "",
  hrefOf: () => "#",
  upload: async () => null,
};

/** Where a starting value comes from when the system works it out. */
const COMPUTED_PREFILL_LABELS: Record<string, string> = {
  today: "today's date",
  grandTotal: "the job's total",
  neededBy: "the date the customer needs it by",
  customerName: "the customer's name",
  customerAddress: "the customer's address",
};

/** Everything on the screen, starting from what is in force. */
function inputOf(
  entry: CatalogEntry,
  settings: DocumentSettings,
): DocumentSettingsInput {
  return {
    code: settings.code ?? entry.counterKey ?? "",
    texts: Object.fromEntries(
      entry.texts.map((text) => [
        text.key,
        settings.texts?.[text.key] ?? text.value,
      ]),
    ),
    fields: Object.fromEntries(
      entry.fields.map((field) => {
        const own = settings.fields?.[field.key];
        return [
          field.key,
          {
            asked: field.locked || own?.asked !== false,
            required: field.locked
              ? Boolean(field.required)
              : (own?.required ?? Boolean(field.required)),
            prefill: canSetPrefill(field)
              ? (own?.prefill ?? field.prefill ?? "")
              : "",
          },
        ];
      }),
    ),
  };
}

/** What is being typed, checked the way the server will check it. */
function checked(
  entry: CatalogEntry,
  draft: DocumentSettingsInput,
):
  | { settings: DocumentSettings; problem: null }
  | { settings: null; problem: string } {
  try {
    return {
      settings: normalizeDocumentSettings(entry, draft, NO_CODES),
      problem: null,
    };
  } catch (error) {
    return {
      settings: null,
      problem:
        error instanceof Error ? error.message : "Check what was entered.",
    };
  }
}

function SectionHeading({ children }: { children: string }) {
  return (
    <h3 className="border-b border-slate-200 pb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
      {children}
    </h3>
  );
}

/** The switches of one detail: asked, required, and what it starts as. */
function FieldSetting({
  field,
  value,
  disabled,
  onChange,
}: {
  field: StageField;
  value: DocumentSettingsInput["fields"][string];
  disabled: boolean;
  onChange: (value: DocumentSettingsInput["fields"][string]) => void;
}) {
  const computed = field.prefill
    ? COMPUTED_PREFILL_LABELS[field.prefill]
    : undefined;

  return (
    <li className="rounded-lg border border-slate-200 px-3 py-2.5">
      <label
        className={`flex items-start gap-2.5 ${field.locked ? "" : "cursor-pointer"}`}
      >
        {field.locked ? (
          <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <input
            type="checkbox"
            checked={value.asked}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...value, asked: event.target.checked })
            }
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-blue-600"
          />
        )}
        <span className="min-w-0">
          <span
            className={`block text-sm font-medium ${value.asked ? "text-slate-900" : "text-slate-400 line-through"}`}
          >
            {field.label}
          </span>
          {field.locked ? (
            <span className="block text-xs text-slate-500">
              Always asked: the system works from this answer.
            </span>
          ) : !value.asked ? (
            <span className="block text-xs text-slate-500">
              Not asked. Its place on the paper is left out or stays empty.
            </span>
          ) : null}
        </span>
      </label>

      {value.asked ? (
        <div className="mt-2 flex flex-col gap-2 pl-[1.625rem]">
          {!field.locked && field.type !== "yesno" ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={value.required}
                disabled={disabled}
                onChange={(event) =>
                  onChange({ ...value, required: event.target.checked })
                }
                className="h-4 w-4 cursor-pointer accent-blue-600"
              />
              Must be filled in before the step moves on
            </label>
          ) : null}
          {computed ? (
            <p className="text-xs text-slate-500">Starts as {computed}.</p>
          ) : canSetPrefill(field) ? (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">
                Starts as (staff can change it on each job)
              </span>
              {field.type === "choice" ? (
                <select
                  value={value.prefill}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({ ...value, prefill: event.target.value })
                  }
                  className="field w-full"
                >
                  <option value="">Nothing chosen</option>
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "longtext" ? (
                <textarea
                  rows={3}
                  value={value.prefill}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({ ...value, prefill: event.target.value })
                  }
                  className="field w-full"
                />
              ) : (
                <input
                  value={value.prefill}
                  disabled={disabled}
                  inputMode={
                    field.type === "number" || field.type === "amount"
                      ? "decimal"
                      : undefined
                  }
                  placeholder="Empty"
                  onChange={(event) =>
                    onChange({ ...value, prefill: event.target.value })
                  }
                  className="field w-full"
                />
              )}
            </label>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** The step's own details as staff will be asked for them; can be tried out. */
function DetailsPreview({
  entry,
  settings,
  answers,
}: {
  entry: CatalogEntry;
  settings: DocumentSettings;
  answers: Record<string, string>;
}) {
  const [values, setValues] = useState(answers);
  return (
    <div className="card mx-auto w-full max-w-2xl p-5">
      <p className="mb-4 rounded-lg bg-primary-soft px-3 py-2 text-sm text-blue-900">
        This is how staff are asked for these details. Nothing typed here is
        saved.
      </p>
      <StageFields
        stage={entry.stage}
        template={{ [STEP_FORM]: settings }}
        values={values}
        onChange={setValues}
        files={NO_UPLOADS}
      />
    </div>
  );
}

/**
 * One paper under Company Docs: where it is used and, for the people who may
 * change it, its wording, its details and its number code on the left, with
 * a sample job on the right that shows every change as it is typed.
 */
export function CompanyDocEditor({
  orgCode,
  initialDetail,
  company,
  today,
}: {
  orgCode: string;
  initialDetail: CompanyDocDetail;
  company: CompanyLetterhead;
  /** The day the page was opened, for the sample job's dates. */
  today: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [detail, setDetail] = useState(initialDetail);
  const { doc, step } = detail;
  const entry = findCatalogEntry(doc.stage, doc.document)!;
  usePageTitle(doc.name);

  const [draft, setDraft] = useState(() => inputOf(entry, detail.settings));
  const [exportJob, setExportJob] = useState(step.number.local === null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);

  const { settings, problem } = checked(entry, draft);
  const dirty =
    settings === null ||
    JSON.stringify(settings) !== JSON.stringify(detail.settings);
  const locked = !detail.canEdit || pending;

  // The sample follows what is typed, even while it cannot be saved yet.
  const previewSettings: DocumentSettings = settings ?? {
    code: draft.code,
    texts: draft.texts,
    fields: draft.fields,
  };
  const stepTemplate = {
    ...detail.templates[doc.stage],
    [doc.document]: previewSettings,
  };
  const templates = { ...detail.templates, [doc.stage]: stepTemplate };
  const sample = sampleInquiry({
    orgCode,
    today,
    jobType: exportJob ? "export" : "local",
    templates,
    show: { stage: doc.stage, document: doc.document },
  });
  const sampleStep = sample.steps.find((item) => item.key === doc.stage)!;
  const code = draft.code.trim().toUpperCase() || entry.counterKey || "";
  const hasBothJobTypes =
    step.number.local !== null &&
    entry.texts.some((text) => text.key === "titleExport");

  /** Run a change and show the paper as it now stands. */
  async function run(
    work: () => Promise<ActionResult<CompanyDocDetail>>,
    done: string,
  ) {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const saved = await unwrap(work());
      setDetail(saved);
      setDraft(inputOf(entry, saved.settings));
      setRestoring(null);
      showToast(done);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (problem) {
      setError(problem);
      return;
    }
    void run(
      () => saveCompanyDocAction(orgCode, doc.stage, doc.document, draft),
      "Saved. New papers use it from now on.",
    );
  }

  const setField = (
    key: string,
    value: DocumentSettingsInput["fields"][string],
  ) => setDraft({ ...draft, fields: { ...draft.fields, [key]: value } });

  return (
    <DocumentSplit
      backHref={`/${orgCode}/company-docs`}
      side={
        // Never taller than the screen: the settings scroll inside the card,
        // so its heading and its buttons stay in view.
        <form
          onSubmit={onSubmit}
          className="card flex flex-col xl:max-h-[calc(100dvh-5rem)]"
        >
          <div className="shrink-0 border-b border-slate-200 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                {doc.name}
              </h2>
              <span
                className={`chip ring-1 ring-inset ${doc.version === 0 ? "bg-slate-100 text-slate-700 ring-slate-300" : "bg-blue-50 text-blue-800 ring-blue-200"}`}
              >
                {doc.version === 0 ? "As built in" : `Version ${doc.version}`}
              </span>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-6 overflow-y-auto px-4 py-4">
            <dl className="divide-y divide-slate-100">
              <StepFacts step={step} />
              <Fact label="When">
                {doc.kind === "details"
                  ? "Every job; asked on screen, not a paper"
                  : whenPrepared(doc.onlyWhen)}
              </Fact>
              <Fact label="Number">
                {entry.counterKey ? (
                  <span className="font-mono text-[13px]">
                    {doc.numberExample}
                  </span>
                ) : doc.kind === "paper" ? (
                  "Carries the number of its step"
                ) : (
                  "None of its own"
                )}
              </Fact>
              <Fact label="Used so far">On {countLabel(doc.used, "job")}</Fact>
            </dl>

            {!detail.canEdit ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Administrators and Management can change this document.
              </p>
            ) : null}

            {detail.canEdit && entry.texts.length > 0 ? (
              <section className="flex flex-col gap-3.5">
                <SectionHeading>Wording on the paper</SectionHeading>
                {entry.texts.map((text) => {
                  const value = draft.texts[text.key] ?? "";
                  const setText = (next: string) =>
                    setDraft({
                      ...draft,
                      texts: { ...draft.texts, [text.key]: next },
                    });
                  const id = `text-${text.key}`;
                  return (
                    <div key={text.key} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor={id} className="field-label">
                          {text.label}
                        </label>
                        {value !== text.value ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setText(text.value)}
                            title="Put back the built-in wording"
                            className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <UndoIcon className="h-3.5 w-3.5" />
                            Built-in wording
                          </button>
                        ) : null}
                      </div>
                      {text.kind === "paragraph" || text.kind === "list" ? (
                        <textarea
                          id={id}
                          rows={text.kind === "list" ? 5 : 4}
                          value={value}
                          disabled={pending}
                          onChange={(event) => setText(event.target.value)}
                          className="field w-full"
                        />
                      ) : (
                        <input
                          id={id}
                          value={value}
                          disabled={pending}
                          onChange={(event) => setText(event.target.value)}
                          className="field w-full"
                        />
                      )}
                      <p className="text-xs text-slate-500">
                        {[
                          text.kind === "list" ? "One point per line." : "",
                          text.kind !== "title"
                            ? "Leave empty to take it off the paper."
                            : "",
                          text.value.includes("{company}")
                            ? "{company} prints the company's name."
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                    </div>
                  );
                })}
              </section>
            ) : null}

            {detail.canEdit && entry.fields.length > 0 ? (
              <section className="flex flex-col gap-3">
                <SectionHeading>Details staff fill in</SectionHeading>
                <ul className="flex flex-col gap-2">
                  {entry.fields.map((field) => (
                    <FieldSetting
                      key={field.key}
                      field={field}
                      value={draft.fields[field.key]!}
                      disabled={locked}
                      onChange={(value) => setField(field.key, value)}
                    />
                  ))}
                </ul>
              </section>
            ) : null}

            {detail.canEdit && entry.counterKey ? (
              <section className="flex flex-col gap-3">
                <SectionHeading>Number</SectionHeading>
                <label className="flex flex-col gap-1.5">
                  <span className="field-label">Code in the number</span>
                  <input
                    value={draft.code}
                    disabled={pending}
                    maxLength={6}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        code: event.target.value.toUpperCase(),
                      })
                    }
                    className="field w-28 font-mono uppercase"
                  />
                  <span className="text-xs text-slate-500">
                    New numbers look like{" "}
                    <span className="font-mono text-slate-700">
                      {orgCode.toUpperCase()}/{code}/{today.slice(0, 4)}/0001
                    </span>
                    . Numbers already given keep their code, and the count
                    carries on.
                  </span>
                </label>
              </section>
            ) : null}

            {detail.canEdit && detail.versions.length > 0 ? (
              <section className="flex flex-col gap-3">
                <SectionHeading>Earlier versions</SectionHeading>
                <ul className="flex flex-col gap-2">
                  {[
                    ...detail.versions,
                    {
                      version: 0,
                      createdAt: "",
                      byName: "",
                      note: "The built-in version",
                    },
                  ].map((item) => {
                    const current = item.version === doc.version;
                    return (
                      <li
                        key={item.version}
                        className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <span className="min-w-0 text-sm">
                          <span className="font-medium text-slate-900">
                            {item.version === 0
                              ? "Built in"
                              : `Version ${item.version}`}
                            {current ? " · in use" : ""}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {item.version === 0
                              ? "As the system came"
                              : `${formatFriendlyDateTime(new Date(item.createdAt))}${item.byName ? ` · ${item.byName}` : ""}`}
                            {item.version !== 0 && item.note
                              ? ` · ${item.note}`
                              : ""}
                          </span>
                        </span>
                        {current ? null : restoring === item.version ? (
                          <span className="flex shrink-0 gap-1.5">
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                void run(
                                  () =>
                                    restoreCompanyDocVersionAction(
                                      orgCode,
                                      doc.stage,
                                      doc.document,
                                      item.version,
                                    ),
                                  item.version === 0
                                    ? "Back to the built-in version"
                                    : `Back to version ${item.version}`,
                                )
                              }
                              className="btn btn-primary btn-sm"
                            >
                              Yes, go back
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => setRestoring(null)}
                              className="btn btn-secondary btn-sm"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setRestoring(item.version)}
                            className="btn btn-secondary btn-sm shrink-0"
                          >
                            Go back to this
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>

          {detail.canEdit ? (
            <>
              {error || (dirty && problem) ? (
                <p
                  role="alert"
                  className="flex shrink-0 items-start gap-2 border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  {error ?? problem}
                </p>
              ) : null}
              <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={pending || !dirty}
                    onClick={() => {
                      setDraft(inputOf(entry, detail.settings));
                      setError(null);
                    }}
                    className="btn btn-secondary"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={pending || !dirty}
                    className="btn btn-primary"
                  >
                    {pending ? "Saving…" : "Save changes"}
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Used on every job from now on. Steps already finished keep
                  their papers as they were.
                </p>
              </div>
            </>
          ) : null}
        </form>
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-900">Sample job.</span>{" "}
          {dirty && detail.canEdit
            ? "Showing your changes; they are not saved yet."
            : "This is how it comes out today."}
        </p>
        {hasBothJobTypes ? (
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
            {[false, true].map((abroad) => (
              <button
                key={String(abroad)}
                type="button"
                onClick={() => setExportJob(abroad)}
                className={`cursor-pointer rounded-md px-2.5 py-1 font-medium transition-colors ${exportJob === abroad ? "bg-primary text-white" : "text-slate-700 hover:bg-slate-100"}`}
              >
                {abroad ? "Export job" : "Local job"}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {doc.kind === "paper" ? (
        <PaperProvider
          state={{
            company,
            inquiry: sample,
            stage: doc.stage,
            template: stepTemplate,
            values: sampleStep.fields,
            items: sample.lineItems,
            tables: sampleStep.tables,
            totals: sample.totals,
          }}
        >
          <StagePaper document={doc.document} />
        </PaperProvider>
      ) : (
        <DetailsPreview
          // Starts again whenever the settings change.
          key={JSON.stringify(previewSettings)}
          entry={entry}
          settings={previewSettings}
          answers={sampleStep.fields}
        />
      )}
    </DocumentSplit>
  );
}
