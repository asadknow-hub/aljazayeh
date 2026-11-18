/** Shared pieces for the test suites. */
import assert from "node:assert/strict";
import { UserError } from "@/lib/errors";
import { SIGNATORY_POSITIONS } from "@/lib/signoffs/chains";
import { setApprovalPinForUser } from "@/lib/signoffs/credentials";
import { setSignatoryForUser } from "@/lib/signoffs/queries";
import { signVacationRequestForUser } from "@/lib/vacation/queries";
import type { VacationRequestInput } from "@/lib/vacation/types";

export const PASSWORD = "correct-horse-battery";
export const PIN = "4821";

/** The work must be refused with a message for the user that matches. */
export const refused = (work: Promise<unknown>, message: RegExp) =>
  assert.rejects(work, (error: unknown) => {
    assert.ok(error instanceof UserError, `expected UserError, got ${error}`);
    assert.match(error.message, message);
    return true;
  });

export function leaveInput(
  staffId: string,
  startDate: string,
  endDate: string,
): VacationRequestInput {
  return {
    staffId,
    startDate,
    endDate,
    leaveType: "annual",
    reason: "",
    jobHandledBy: "",
    leaveAvailableDays: "",
    officeComments: "",
  };
}

/** Make one person hold every signing position, with a PIN to sign with. */
export async function makeSoleSignatory(
  adminUserId: string,
  orgCode: string,
  signer: { userId: string; staffId: string },
) {
  for (const position of SIGNATORY_POSITIONS) {
    await setSignatoryForUser(
      adminUserId,
      orgCode,
      position.key,
      signer.staffId,
    );
  }
  await setApprovalPinForUser(signer.userId, { password: PASSWORD, pin: PIN });
}

/** Sign every remaining box of a leave request as the sole signatory. */
export async function approveLeaveFully(
  signerUserId: string,
  orgCode: string,
  requestId: string,
) {
  for (let step = 0; step < SIGNATORY_POSITIONS.length; step += 1) {
    const status = await signVacationRequestForUser(
      signerUserId,
      orgCode,
      requestId,
      { pin: PIN, decision: "approved", remarks: "" },
    );
    if (status !== "pending") return status;
  }
  throw new Error("The leave request was never fully approved.");
}
