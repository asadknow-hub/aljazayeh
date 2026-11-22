import "server-only";

import { desc, eq } from "drizzle-orm";
import type { DbTransaction } from "@/db/client";
import { documentTemplates } from "@/db/schema";
import { parseTemplateKey } from "@/lib/company-docs/catalog";
import type { InquiryStageKey } from "@/lib/inquiries/stages";
import type {
  DocumentSettings,
  StepTemplate,
} from "@/lib/inquiries/stage-forms";

export type LiveTemplate = {
  version: number;
  settings: DocumentSettings;
  createdAt: Date;
  createdByUserId: string;
};

/** The version in force of every paper the company has changed, by key. */
export async function loadLiveTemplates(
  tx: DbTransaction,
  organizationId: string,
): Promise<Map<string, LiveTemplate>> {
  const rows = await tx
    .selectDistinctOn([documentTemplates.documentKey], {
      documentKey: documentTemplates.documentKey,
      version: documentTemplates.version,
      settings: documentTemplates.settings,
      createdAt: documentTemplates.createdAt,
      createdByUserId: documentTemplates.createdByUserId,
    })
    .from(documentTemplates)
    .where(eq(documentTemplates.organizationId, organizationId))
    .orderBy(documentTemplates.documentKey, desc(documentTemplates.version));

  return new Map(rows.map(({ documentKey, ...live }) => [documentKey, live]));
}

/** The company's settings in force, grouped by step. */
export async function loadStepTemplates(
  tx: DbTransaction,
  organizationId: string,
): Promise<Partial<Record<InquiryStageKey, StepTemplate>>> {
  const steps: Partial<Record<InquiryStageKey, StepTemplate>> = {};
  for (const [key, live] of await loadLiveTemplates(tx, organizationId)) {
    const place = parseTemplateKey(key);
    if (!place) continue;
    (steps[place.stage] ??= {})[place.document] = live.settings;
  }
  return steps;
}
