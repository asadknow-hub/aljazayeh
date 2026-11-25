import "server-only";

import { loadBankAccounts } from "@/lib/banks/queries";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { withTenantContext, type DbTransaction } from "@/db/client";
import {
  approvalForms,
  documentTemplates,
  inquiries,
  inquiryStageRecords,
  vacationRequests,
} from "@/db/schema";
import { assertCan, can } from "@/lib/access/access";
import {
  builtInCodes,
  findCatalogEntry,
  INQUIRY_CATALOG,
  SIGNED_FORM_KEYS,
  templateKey,
  type CatalogEntry,
  type SignedFormKey,
} from "@/lib/company-docs/catalog";
import {
  loadLiveTemplates,
  loadStepTemplates,
  type LiveTemplate,
} from "@/lib/company-docs/templates";
import type {
  CompanyDocDetail,
  CompanyDocRow,
  CompanyDocStep,
  CompanyDocsOverview,
  SignedFormRow,
} from "@/lib/company-docs/types";
import {
  normalizeDocumentSettings,
  type DocumentSettingsInput,
} from "@/lib/company-docs/validate";
import { appDateValue } from "@/lib/datetime/format";
import { departmentLabel } from "@/lib/departments/catalog";
import { UserError } from "@/lib/errors";
import {
  FORM_DEFINITIONS,
  formListPath,
  isFormType,
} from "@/lib/forms/definitions";
import {
  loadDisplayNames,
  loadWorkflow,
  type Workflow,
} from "@/lib/inquiries/queries";
import {
  INQUIRY_STAGES,
  stagesForJob,
  type InquiryStageKey,
} from "@/lib/inquiries/stages";
import {
  numberCode,
  STAGE_DEFINITIONS,
  type StepTemplate,
} from "@/lib/inquiries/stage-forms";
import { requireOrg, resolveOrg, type ResolvedOrg } from "@/lib/org/resolve";
import { loadSignoffState } from "@/lib/signoffs/queries";

/** What a document's numbers look like this year. */
function numberExample(code: string): string {
  return `${code}/${appDateValue().slice(0, 4)}/0001`;
}

function placeOf(stage: InquiryStageKey, jobType: string): number | null {
  const index = stagesForJob(jobType).findIndex((item) => item.key === stage);
  return index === -1 ? null : index + 1;
}

function stepOf(
  stage: InquiryStageKey,
  workflow: Workflow,
): Omit<CompanyDocStep, "docs"> {
  return {
    stage,
    label: INQUIRY_STAGES.find((item) => item.key === stage)!.label,
    number: {
      local: placeOf(stage, "local"),
      export: placeOf(stage, "export"),
    },
    departmentKey: workflow.map[stage].departmentKey,
    approvalBy: workflow.approvers[stage]?.label ?? "",
  };
}

/**
 * How many jobs have each paper so far. A step's own papers count every job
 * that reached the step; a paper only some jobs need counts the jobs whose
 * answers ask for it.
 */
async function loadUsage(
  tx: DbTransaction,
  organizationId: string,
): Promise<(entry: CatalogEntry) => number> {
  const [started] = await tx
    .select({ jobs: count() })
    .from(inquiries)
    .where(eq(inquiries.organizationId, organizationId));
  const reached = new Map(
    (
      await tx
        .select({ stage: inquiryStageRecords.stageKey, jobs: count() })
        .from(inquiryStageRecords)
        .where(
          and(
            eq(inquiryStageRecords.organizationId, organizationId),
            sql`${inquiryStageRecords.documentNumber} <> ''`,
          ),
        )
        .groupBy(inquiryStageRecords.stageKey)
    ).map((row) => [row.stage, row.jobs]),
  );

  const optional = new Map<string, number>();
  for (const stage of INQUIRY_STAGES) {
    for (const doc of STAGE_DEFINITIONS[stage.key].documents) {
      if (!doc.enabledWhen) continue;
      const [row] = await tx
        .select({ jobs: count() })
        .from(inquiryStageRecords)
        .where(
          and(
            eq(inquiryStageRecords.organizationId, organizationId),
            eq(inquiryStageRecords.stageKey, stage.key),
            sql`${inquiryStageRecords.fields} ->> ${doc.enabledWhen.field} = ${doc.enabledWhen.value}`,
          ),
        );
      optional.set(templateKey(stage.key, doc.key), row?.jobs ?? 0);
    }
  }

  return (entry) =>
    optional.get(templateKey(entry.stage, entry.document)) ??
    (entry.stage === "inquiry"
      ? (started?.jobs ?? 0)
      : (reached.get(entry.stage) ?? 0));
}

function toRow(
  org: ResolvedOrg,
  entry: CatalogEntry,
  live: LiveTemplate | undefined,
  used: number,
  names: Map<string, string>,
): CompanyDocRow {
  return {
    stage: entry.stage,
    document: entry.document,
    name: entry.name,
    kind: entry.kind,
    onlyWhen: entry.onlyWhen,
    numberExample: entry.counterKey
      ? numberExample(numberCode(entry.counterKey, live?.settings))
      : null,
    used,
    version: live?.version ?? 0,
    changedAt: live?.createdAt.toISOString() ?? null,
    changedByName: live ? (names.get(live.createdByUserId) ?? null) : null,
  };
}

/** The signed forms: where each is raised, who signs it, how many there are. */
async function loadSignedForms(
  tx: DbTransaction,
  org: ResolvedOrg,
): Promise<SignedFormRow[]> {
  const formCounts = await tx
    .select({
      type: approvalForms.formType,
      status: approvalForms.status,
      forms: count(),
    })
    .from(approvalForms)
    .where(eq(approvalForms.organizationId, org.id))
    .groupBy(approvalForms.formType, approvalForms.status);
  const leaveCounts = await tx
    .select({ status: vacationRequests.status, forms: count() })
    .from(vacationRequests)
    .where(eq(vacationRequests.organizationId, org.id))
    .groupBy(vacationRequests.status);
  const counted = (key: SignedFormKey) =>
    key === "leave_request"
      ? leaveCounts
      : formCounts.filter((row) => row.type === key);

  const rows: SignedFormRow[] = [];
  for (const key of SIGNED_FORM_KEYS) {
    // The boxes of a form nobody has raised: who would sign it today.
    const signoffs = await loadSignoffState(tx, org, key, crypto.randomUUID(), {
      finished: false,
    });
    const counts = counted(key);
    const form = isFormType(key) ? FORM_DEFINITIONS[key] : null;
    rows.push({
      key,
      name: form?.title ?? "Leave Request Application",
      raisedIn:
        !form || form.raisedIn === "reception"
          ? "Reception"
          : departmentLabel(form.raisedIn),
      // A link only for someone who works where the form is raised;
      // anyone else would find the page closed to them.
      raisedHref: !(
        !form || form.raisedIn === "reception"
          ? can.useReception(org.access)
          : can.openDepartment(org.access, form.raisedIn)
      )
        ? null
        : isFormType(key)
          ? formListPath(org.code, key)
          : `/${org.code}/reception?section=vacation`,
      signers: signoffs.steps.map((step) => ({
        label: step.label,
        name: step.expectedName,
        preparer: step.preparer,
      })),
      numberExample: form ? numberExample(form.counterKey) : null,
      raised: counts.reduce((total, row) => total + row.forms, 0),
      waiting: counts
        .filter((row) => row.status === "pending")
        .reduce((total, row) => total + row.forms, 0),
    });
  }
  return rows;
}

/** Company Docs: every paper the company has and where it is used. */
export async function getCompanyDocsForUser(
  userId: string,
  orgCode: string,
): Promise<CompanyDocsOverview | null> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org) return null;

    const workflow = await loadWorkflow(tx, org.id);
    const live = await loadLiveTemplates(tx, org.id);
    const usage = await loadUsage(tx, org.id);
    const names = await loadDisplayNames(
      tx,
      [...live.values()].map((item) => item.createdByUserId),
    );

    return {
      steps: INQUIRY_STAGES.map((stage) => ({
        ...stepOf(stage.key, workflow),
        docs: INQUIRY_CATALOG.filter((entry) => entry.stage === stage.key).map(
          (entry) =>
            toRow(
              org,
              entry,
              live.get(templateKey(entry.stage, entry.document)),
              usage(entry),
              names,
            ),
        ),
      })),
      forms: await loadSignedForms(tx, org),
      canEdit: can.editCompanyDocs(org.access),
    };
  });
}

async function loadDetail(
  tx: DbTransaction,
  org: ResolvedOrg,
  entry: CatalogEntry,
): Promise<CompanyDocDetail> {
  const key = templateKey(entry.stage, entry.document);
  const versions = await tx
    .select({
      version: documentTemplates.version,
      settings: documentTemplates.settings,
      note: documentTemplates.note,
      createdAt: documentTemplates.createdAt,
      createdByUserId: documentTemplates.createdByUserId,
    })
    .from(documentTemplates)
    .where(
      and(
        eq(documentTemplates.organizationId, org.id),
        eq(documentTemplates.documentKey, key),
      ),
    )
    .orderBy(desc(documentTemplates.version));
  const names = await loadDisplayNames(
    tx,
    versions.map((item) => item.createdByUserId),
  );
  const live = versions[0];

  return {
    step: stepOf(entry.stage, await loadWorkflow(tx, org.id)),
    doc: toRow(org, entry, live, (await loadUsage(tx, org.id))(entry), names),
    settings: live?.settings ?? {},
    templates: await loadStepTemplates(tx, org.id),
    versions: versions.map((item) => ({
      version: item.version,
      createdAt: item.createdAt.toISOString(),
      byName: names.get(item.createdByUserId) ?? "",
      note: item.note,
    })),
    sampleBank: (await loadBankAccounts(tx, org.id))[0] ?? null,
    canEdit: can.editCompanyDocs(org.access),
  };
}

/** One paper: where it is used, what the company changed, and its history. */
export async function getCompanyDocForUser(
  userId: string,
  orgCode: string,
  stage: string,
  document: string,
): Promise<CompanyDocDetail | null> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    const entry = findCatalogEntry(stage, document);
    if (!org || !entry) return null;
    return loadDetail(tx, org, entry);
  });
}

/** One signed form, for its page under Company Docs. */
export async function getSignedFormDocForUser(
  userId: string,
  orgCode: string,
  key: SignedFormKey,
): Promise<SignedFormRow | null> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org) return null;
    return (await loadSignedForms(tx, org)).find((row) => row.key === key)!;
  });
}

/** The settings in force of one step, for a form that is not on an inquiry yet. */
export async function getStepTemplateForUser(
  userId: string,
  orgCode: string,
  stage: InquiryStageKey,
): Promise<StepTemplate> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org) return {};
    return (await loadStepTemplates(tx, org.id))[stage] ?? {};
  });
}

/** Add a version of a paper's settings; it is in force from now on. */
async function addVersion(
  tx: DbTransaction,
  org: ResolvedOrg,
  userId: string,
  entry: CatalogEntry,
  settings: CompanyDocDetail["settings"],
  note: string,
) {
  const key = templateKey(entry.stage, entry.document);
  const [latest] = await tx
    .select({
      version: documentTemplates.version,
      settings: documentTemplates.settings,
    })
    .from(documentTemplates)
    .where(
      and(
        eq(documentTemplates.organizationId, org.id),
        eq(documentTemplates.documentKey, key),
      ),
    )
    .orderBy(desc(documentTemplates.version))
    .limit(1);
  if (JSON.stringify(latest?.settings ?? {}) === JSON.stringify(settings)) {
    throw new UserError("Nothing was changed.");
  }

  await tx.insert(documentTemplates).values({
    organizationId: org.id,
    documentKey: key,
    version: (latest?.version ?? 0) + 1,
    settings,
    note,
    createdByUserId: userId,
  });
}

/**
 * Codes other documents use or have ever used. Taking one of them would give
 * two kinds of document the same numbers.
 */
async function loadTakenCodes(
  tx: DbTransaction,
  org: ResolvedOrg,
  entry: CatalogEntry,
): Promise<Set<string>> {
  const taken = builtInCodes(entry);
  const rows = await tx
    .select({
      documentKey: documentTemplates.documentKey,
      code: sql<string | null>`${documentTemplates.settings} ->> 'code'`,
    })
    .from(documentTemplates)
    .where(eq(documentTemplates.organizationId, org.id));
  for (const row of rows) {
    if (
      row.code &&
      row.documentKey !== templateKey(entry.stage, entry.document)
    ) {
      taken.add(row.code);
    }
  }
  return taken;
}

async function requireEditableEntry(
  tx: DbTransaction,
  userId: string,
  orgCode: string,
  stage: string,
  document: string,
) {
  const org = await requireOrg(tx, userId, orgCode);
  assertCan(can.editCompanyDocs(org.access));
  const entry = findCatalogEntry(stage, document);
  if (!entry) throw new UserError("That document does not exist.");
  return { org, entry };
}

/** Save what was changed about a paper. New papers use it from now on. */
export async function saveCompanyDocForUser(
  userId: string,
  orgCode: string,
  stage: string,
  document: string,
  input: DocumentSettingsInput,
): Promise<CompanyDocDetail> {
  return withTenantContext(userId, async (tx) => {
    const { org, entry } = await requireEditableEntry(
      tx,
      userId,
      orgCode,
      stage,
      document,
    );
    const settings = normalizeDocumentSettings(
      entry,
      input,
      await loadTakenCodes(tx, org, entry),
    );
    await addVersion(tx, org, userId, entry, settings, "");
    return loadDetail(tx, org, entry);
  });
}

/**
 * Go back to an earlier version of a paper, or to the built-in one
 * (version 0). The versions in between are kept.
 */
export async function restoreCompanyDocVersionForUser(
  userId: string,
  orgCode: string,
  stage: string,
  document: string,
  version: number,
): Promise<CompanyDocDetail> {
  return withTenantContext(userId, async (tx) => {
    const { org, entry } = await requireEditableEntry(
      tx,
      userId,
      orgCode,
      stage,
      document,
    );

    let settings: CompanyDocDetail["settings"] = {};
    if (version !== 0) {
      const [row] = await tx
        .select({ settings: documentTemplates.settings })
        .from(documentTemplates)
        .where(
          and(
            eq(documentTemplates.organizationId, org.id),
            eq(
              documentTemplates.documentKey,
              templateKey(entry.stage, entry.document),
            ),
            eq(documentTemplates.version, version),
          ),
        )
        .limit(1);
      if (!row) throw new UserError("That version does not exist.");
      settings = row.settings;
    }

    await addVersion(
      tx,
      org,
      userId,
      entry,
      settings,
      version === 0
        ? "Back to the built-in version"
        : `Back to version ${version}`,
    );
    return loadDetail(tx, org, entry);
  });
}
