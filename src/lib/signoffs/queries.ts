import "server-only";

import { and, asc, eq, isNotNull } from "drizzle-orm";
import { withTenantContext, type DbTransaction } from "@/db/client";
import {
  documentSignoffs,
  signatoryPositions,
  staffMembers,
  users,
} from "@/db/schema";
import { assertCan, can } from "@/lib/access/access";
import { UserError } from "@/lib/errors";
import { requireOrg, resolveOrg, type ResolvedOrg } from "@/lib/org/resolve";
import {
  DOCUMENT_CHAINS,
  SIGNATORY_POSITIONS,
  isPositionKey,
  positionLabel,
  type ChainStep,
  type DocumentType,
  type PositionKey,
  type SignoffDecision,
  type SignoffState,
} from "@/lib/signoffs/chains";

/* ------------------------------- signatories ------------------------------ */

type Holder = { staffId: string; fullName: string };

/** Who currently holds each signing position in the company. */
async function loadHolders(
  tx: DbTransaction,
  organizationId: string,
): Promise<Map<PositionKey, Holder>> {
  const rows = await tx
    .select({
      positionKey: signatoryPositions.positionKey,
      staffId: staffMembers.id,
      fullName: staffMembers.fullName,
    })
    .from(signatoryPositions)
    .innerJoin(staffMembers, eq(staffMembers.id, signatoryPositions.staffId))
    .where(eq(signatoryPositions.organizationId, organizationId));

  const holders = new Map<PositionKey, Holder>();
  for (const row of rows) {
    if (isPositionKey(row.positionKey)) {
      holders.set(row.positionKey, {
        staffId: row.staffId,
        fullName: row.fullName,
      });
    }
  }
  return holders;
}

export type SignatoriesView = {
  positions: { key: PositionKey; label: string; staffId: string }[];
  /** Staff who can be given a position: active, with a login. */
  candidates: { id: string; fullName: string; jobTitle: string }[];
};

export async function getSignatoriesForUser(
  userId: string,
  orgCode: string,
): Promise<SignatoriesView | null> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.manageCompany(org.access)) return null;

    const holders = await loadHolders(tx, org.id);
    const candidates = await tx
      .select({
        id: staffMembers.id,
        fullName: staffMembers.fullName,
        jobTitle: staffMembers.jobTitle,
      })
      .from(staffMembers)
      .where(
        and(
          eq(staffMembers.organizationId, org.id),
          eq(staffMembers.status, "active"),
          isNotNull(staffMembers.userId),
        ),
      )
      .orderBy(asc(staffMembers.fullName));

    return {
      positions: SIGNATORY_POSITIONS.map((position) => ({
        ...position,
        staffId: holders.get(position.key)?.staffId ?? "",
      })),
      candidates,
    };
  });
}

/** Give a signing position to a staff member, or leave it empty. */
export async function setSignatoryForUser(
  userId: string,
  orgCode: string,
  positionKey: string,
  staffId: string,
): Promise<void> {
  if (!isPositionKey(positionKey)) {
    throw new UserError("Unknown signing position.");
  }

  await withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    assertCan(can.manageCompany(org.access));

    if (!staffId) {
      await tx
        .delete(signatoryPositions)
        .where(
          and(
            eq(signatoryPositions.organizationId, org.id),
            eq(signatoryPositions.positionKey, positionKey),
          ),
        );
      return;
    }

    const [staff] = await tx
      .select({ userId: staffMembers.userId })
      .from(staffMembers)
      .where(
        and(
          eq(staffMembers.id, staffId),
          eq(staffMembers.organizationId, org.id),
          eq(staffMembers.status, "active"),
        ),
      )
      .limit(1);
    if (!staff?.userId) {
      throw new UserError(
        "Only an active staff member with a login can sign documents.",
      );
    }

    await tx
      .insert(signatoryPositions)
      .values({ organizationId: org.id, positionKey, staffId })
      .onConflictDoUpdate({
        target: [
          signatoryPositions.organizationId,
          signatoryPositions.positionKey,
        ],
        set: { staffId, updatedAt: new Date() },
      });
  });
}

/* -------------------------------- sign-offs ------------------------------- */

const chainOf = (type: DocumentType): readonly ChainStep[] =>
  DOCUMENT_CHAINS[type];

/** A document can only be raised once everyone who must sign it is known. */
export async function assertChainStaffed(
  tx: DbTransaction,
  org: ResolvedOrg,
  type: DocumentType,
): Promise<void> {
  const holders = await loadHolders(tx, org.id);
  const missing = chainOf(type)
    .map((step) => step.signer)
    .filter(
      (signer): signer is PositionKey =>
        signer !== "preparer" && !holders.has(signer),
    );

  if (missing.length > 0) {
    throw new UserError(
      `Nobody is set as ${missing.map(positionLabel).join(", ")} yet. An administrator sets this in Company Settings → Signatories.`,
    );
  }
}

/** Whether the signed-in person holds any position that signs this document. */
export async function isSignerOf(
  tx: DbTransaction,
  org: ResolvedOrg,
  type: DocumentType,
): Promise<boolean> {
  const holders = await loadHolders(tx, org.id);
  return chainOf(type).some(
    (step) =>
      step.signer !== "preparer" &&
      holders.get(step.signer)?.staffId === org.access.staffId,
  );
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

/** The signature boxes of a document and where it stands. */
export async function loadSignoffState(
  tx: DbTransaction,
  org: ResolvedOrg,
  type: DocumentType,
  documentId: string,
): Promise<SignoffState> {
  const chain = chainOf(type);
  const holders = await loadHolders(tx, org.id);
  const rows = await loadSignoffRows(tx, type, documentId);
  const signedByStep = new Map(rows.map((row) => [row.step, row]));

  const steps = chain.map((step, index) => {
    const row = signedByStep.get(index);
    return {
      label: step.label,
      expectedName:
        step.signer === "preparer"
          ? (row?.signerName ?? "")
          : (holders.get(step.signer)?.fullName ?? ""),
      signed: row
        ? {
            decision: row.decision as SignoffDecision,
            name: row.signerName,
            signatureImage: row.signatureImage,
            remarks: row.remarks,
            signedAt: row.signedAt.toISOString(),
          }
        : null,
    };
  });

  const rejected = rows.some((row) => row.decision === "rejected");
  const nextIndex = steps.findIndex((step) => !step.signed);
  const status = rejected
    ? "rejected"
    : nextIndex === -1
      ? "approved"
      : "pending";

  const next = status === "pending" ? chain[nextIndex]! : null;
  return {
    steps,
    status,
    waitingFor: next ? next.label : null,
    canSign:
      next !== null &&
      next.signer !== "preparer" &&
      holders.get(next.signer)?.staffId === org.access.staffId,
  };
}

async function insertSignoff(
  tx: DbTransaction,
  org: ResolvedOrg,
  userId: string,
  values: {
    type: DocumentType;
    documentId: string;
    step: number;
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

  await tx.insert(documentSignoffs).values({
    organizationId: org.id,
    documentType: values.type,
    documentId: values.documentId,
    step: values.step,
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
  const step = chainOf(type).findIndex((item) => item.signer === "preparer");
  if (step === -1) return;
  await insertSignoff(tx, org, userId, {
    type,
    documentId,
    step,
    decision: "approved",
    remarks: "",
  });
}

/**
 * Sign the next box of a document. The caller has already checked the
 * signer's PIN. Returns where the document stands afterwards.
 */
export async function signNextStep(
  tx: DbTransaction,
  org: ResolvedOrg,
  userId: string,
  type: DocumentType,
  documentId: string,
  input: { decision: SignoffDecision; remarks: string },
): Promise<SignoffState> {
  const state = await loadSignoffState(tx, org, type, documentId);
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

  await insertSignoff(tx, org, userId, {
    type,
    documentId,
    step: state.steps.findIndex((step) => !step.signed),
    decision: input.decision,
    remarks,
  });

  return loadSignoffState(tx, org, type, documentId);
}
