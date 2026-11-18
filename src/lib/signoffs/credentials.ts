import "server-only";

import { eq, sql } from "drizzle-orm";
import { withTenantContext } from "@/db/client";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { UserError } from "@/lib/errors";
import {
  APPROVAL_PIN_PATTERN,
  MAX_SIGNATURE_LENGTH,
} from "@/lib/signoffs/chains";

/** Wrong PINs allowed before the PIN is locked and has to be set again. */
const MAX_PIN_FAILURES = 5;

export type SigningProfile = {
  signatureImage: string | null;
  hasPin: boolean;
  pinLocked: boolean;
};

export async function getSigningProfile(
  userId: string,
): Promise<SigningProfile> {
  return withTenantContext(userId, async (tx) => {
    const [user] = await tx
      .select({
        signatureImage: users.signatureImage,
        pinHash: users.approvalPinHash,
        failures: users.approvalPinFailures,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return {
      signatureImage: user?.signatureImage ?? null,
      hasPin: Boolean(user?.pinHash),
      pinLocked: (user?.failures ?? 0) >= MAX_PIN_FAILURES,
    };
  });
}

/** Save the signature drawn or uploaded on the Account page (PNG data URL). */
export async function saveSignatureForUser(
  userId: string,
  signatureImage: string | null,
): Promise<void> {
  if (signatureImage !== null) {
    if (!signatureImage.startsWith("data:image/png;base64,")) {
      throw new UserError("The signature must be a PNG image.");
    }
    if (signatureImage.length > MAX_SIGNATURE_LENGTH) {
      throw new UserError("The signature image is too large.");
    }
  }

  await withTenantContext(userId, (tx) =>
    tx
      .update(users)
      .set({ signatureImage, updatedAt: new Date() })
      .where(eq(users.id, userId)),
  );
}

/** Set or replace the approval PIN. The account password is required. */
export async function setApprovalPinForUser(
  userId: string,
  input: { password: string; pin: string },
): Promise<void> {
  if (!APPROVAL_PIN_PATTERN.test(input.pin)) {
    throw new UserError("The PIN must be 4 to 6 digits.");
  }
  const pinHash = await hashPassword(input.pin);

  await withTenantContext(userId, async (tx) => {
    const [user] = await tx
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new UserError("Your password is incorrect.");
    }

    await tx
      .update(users)
      .set({
        approvalPinHash: pinHash,
        approvalPinFailures: 0,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  });
}

/**
 * Check the PIN entered for an approval. Runs in its own transaction so a
 * wrong attempt is counted even though the approval itself is abandoned.
 */
export async function verifyApprovalPin(
  userId: string,
  pin: string,
): Promise<void> {
  const problem = await withTenantContext(userId, async (tx) => {
    const [user] = await tx
      .select({
        pinHash: users.approvalPinHash,
        failures: users.approvalPinFailures,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user?.pinHash) {
      return "Set your approval PIN under Account → Signature first.";
    }
    if (user.failures >= MAX_PIN_FAILURES) {
      return "Your PIN is locked after too many wrong attempts. Set a new one under Account → Signature.";
    }

    const correct = await verifyPassword(pin, user.pinHash);
    await tx
      .update(users)
      .set({
        approvalPinFailures: correct
          ? 0
          : sql`${users.approvalPinFailures} + 1`,
      })
      .where(eq(users.id, userId));

    return correct ? null : "Wrong PIN.";
  });

  if (problem) throw new UserError(problem);
}
