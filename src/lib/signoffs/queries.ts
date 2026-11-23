import "server-only";

import { and, asc, eq } from "drizzle-orm";
import type { DbTransaction } from "@/db/client";
import { documentSignoffs, users } from "@/db/schema";
import { UserError } from "@/lib/errors";
import type { ResolvedOrg } from "@/lib/org/resolve";
import { loadPositions } from "@/lib/organization/positions";
import {
  PREPARER_KEY,
  resolveChain,
  type ChainBox,
  type DocumentType,
  type SignoffDecision,
  type SignoffState,
  type SignoffStepView,
} from "@/lib/signoffs/chains";

/** The boxes a document has today, from the organisation chart. */
async function loadChain(
  tx: DbTransaction,
  org: ResolvedOrg,
  type: DocumentType,
): Promise<ChainBox[]> {
  return resolveChain(type, await loadPositions(tx, org.id));
}

/**
 * A document can only be raised once everyone who must sign it is known.
 * A position that is on the chart with nobody in it holds the form up; one
 * that is not on the chart is simply not asked for.
 */
export async function assertChainStaffed(
  tx: DbTransaction,
  org: ResolvedOrg,
  type: DocumentType,
): Promise<void> {
  const vacant = (await loadChain(tx, org, type)).filter(
    (box) => box.key !== PREPARER_KEY && !box.staffId,
  );
  if (vacant.length > 0) {
    throw new UserError(
      `Nobody is set as ${vacant.map((box) => box.title).join(", ")} yet. An administrator names them under Organization.`,
    );
  }
}

async function loadSignoffRows(
  tx: DbTransaction,
  type: DocumentType,
  documentId: string,
) {
  return tx
    .select()
    .from(documentSignoffs)
    .where(
      and(
        eq(documentSignoffs.documentType, type),
        eq(documentSignoffs.documentId, documentId),
      ),
    )
    .orderBy(asc(documentSignoffs.step));
}

type SignoffRow = Awaited<ReturnType<typeof loadSignoffRows>>[number];

const signedBox = (row: SignoffRow): SignoffStepView => ({
  label: row.label,
  preparer: row.signerKey === PREPARER_KEY,
  expectedName: row.signerName,
  signed: {
    decision: row.decision as SignoffDecision,
    name: row.signerName,
    signatureImage: row.signatureImage,
    remarks: row.remarks,
    signedAt: row.signedAt.toISOString(),
  },
});

/**
 * Whether the signed-in person has to do with a document's signatures: they
 * signed it, or they hold a position that signs this kind of document.
 */
export async function isSignerOf(
  tx: DbTransaction,
  org: ResolvedOrg,
  userId: string,
  type: DocumentType,
  documentId: string,
): Promise<boolean> {
  const chain = await loadChain(tx, org, type);
  if (chain.some((box) => box.staffId === org.access.staffId)) return true;
  const rows = await loadSignoffRows(tx, type, documentId);
  return rows.some((row) => row.signedByUserId === userId);
}

/**
 * The signature boxes of a document and where it stands.
 *
 * A finished document shows exactly the signatures it was finished with.
 * One still going round shows the signatures given so far, then the boxes
 * the chart asks for today that are not signed yet: a position removed from
 * the chart is no longer waited for, and a new owner gets a box.
 */
export async function loadSignoffState(
  tx: DbTransaction,
  org: ResolvedOrg,
  type: DocumentType,
  documentId: string,
  options: { finished: boolean },
): Promise<SignoffState> {
  const rows = await loadSignoffRows(tx, type, documentId);
  const rejected = rows.some((row) => row.decision === "rejected");
  const signed = rows.map(signedBox);

  if (options.finished || rejected) {
    return {
      steps: signed,
      status: rejected ? "rejected" : "approved",
      waitingFor: null,
      canSign: false,
    };
  }

  const signedKeys = new Set(rows.map((row) => row.signerKey));
  const waiting = (await loadChain(tx, org, type)).filter(
    (box) => !signedKeys.has(box.key),
  );
  const next = waiting[0] ?? null;

  return {
    steps: [
      ...signed,
      ...waiting.map((box) => ({
        label: box.label,
        preparer: box.key === PREPARER_KEY,
        expectedName: box.staffName,
        signed: null,
      })),
    ],
    status: next ? "pending" : "approved",
    waitingFor: next ? next.label : null,
    canSign:
      next !== null &&
      next.key !== PREPARER_KEY &&
      next.staffId === org.access.staffId,
  };
}

async function insertSignoff(
  tx: DbTransaction,
  org: ResolvedOrg,
  userId: string,
  values: {
    type: DocumentType;
    documentId: string;
    box: ChainBox;
    decision: SignoffDecision;
    remarks: string;
  },
) {
  const [signer] = await tx
    .select({
      fullName: users.fullName,
      username: users.username,
      signatureImage: users.signatureImage,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!signer) throw new UserError("User not found.");

  const rows = await loadSignoffRows(tx, values.type, values.documentId);
  await tx.insert(documentSignoffs).values({
    organizationId: org.id,
    documentType: values.type,
    documentId: values.documentId,
    step: rows.length,
    signerKey: values.box.key,
    label: values.box.label,
    decision: values.decision,
    signedByUserId: userId,
    signerName: signer.fullName.trim() || signer.username,
    signatureImage: signer.signatureImage,
    remarks: values.remarks,
  });
}

/** Raising a document signs its "Prepared By" box for whoever raised it. */
export async function signAsPreparer(
  tx: DbTransaction,
  org: ResolvedOrg,
  userId: string,
  type: DocumentType,
  documentId: string,
): Promise<void> {
  const box = (await loadChain(tx, org, type)).find(
    (item) => item.key === PREPARER_KEY,
  );
  if (!box) return;
  await insertSignoff(tx, org, userId, {
    type,
    documentId,
    box,
    decision: "approved",
    remarks: "",
  });
}

/**
 * Sign the next box of a document that is still going round. The caller has
 * already checked the signer's PIN. Returns where the document stands
 * afterwards.
 */
export async function signNextStep(
  tx: DbTransaction,
  org: ResolvedOrg,
  userId: string,
  type: DocumentType,
  documentId: string,
  input: { decision: SignoffDecision; remarks: string },
): Promise<SignoffState> {
  const state = await loadSignoffState(tx, org, type, documentId, {
    finished: false,
  });
  if (state.status !== "pending") {
    throw new UserError(`This document is already ${state.status}.`);
  }
  if (!state.canSign) {
    throw new UserError(
      `This document is waiting for: ${state.waitingFor}. It is not your turn to sign.`,
    );
  }

  const remarks = input.remarks.trim();
  if (input.decision === "rejected" && !remarks) {
    throw new UserError("Give a reason for rejecting.");
  }

  const rows = await loadSignoffRows(tx, type, documentId);
  const signedKeys = new Set(rows.map((row) => row.signerKey));
  const box = (await loadChain(tx, org, type)).find(
    (item) => !signedKeys.has(item.key),
  )!;
  await insertSignoff(tx, org, userId, {
    type,
    documentId,
    box,
    decision: input.decision,
    remarks,
  });

  return loadSignoffState(tx, org, type, documentId, { finished: false });
}
