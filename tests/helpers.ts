/** Shared pieces for the test suites. */
import assert from "node:assert/strict";
import { UserError } from "@/lib/errors";
import { DEFAULT_POSITIONS } from "@/lib/organization/chart";
import {
  getOrganizationChartForUser,
  updatePositionForUser,
} from "@/lib/organization/queries";
import type { ChartPosition } from "@/lib/organization/types";
import { setApprovalPinForUser } from "@/lib/signoffs/credentials";
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

/** Every position on a company's organisation chart. */
export async function chartPositions(
  userId: string,
  orgCode: string,
): Promise<ChartPosition[]> {
  const chart = await getOrganizationChartForUser(userId, orgCode);
  assert.ok(chart);
  return [
    ...chart.owners,
    ...chart.departments.flatMap((department) => department.positions),
  ];
}

/** Name who holds positions of the chart, by the position's title. */
export async function namePositions(
  adminUserId: string,
  orgCode: string,
  holders: Record<string, { staffId: string }>,
) {
  const positions = await chartPositions(adminUserId, orgCode);
  for (const [title, person] of Object.entries(holders)) {
    const position = positions.find((item) => item.title === title);
    assert.ok(position, `no position called ${title}`);
    await updatePositionForUser(adminUserId, orgCode, position.id, {
      title,
      staffId: person.staffId,
    });
  }
}

/** Make one person hold every position, with a PIN to sign with. */
export async function makeSoleSignatory(
  adminUserId: string,
  orgCode: string,
  signer: { userId: string; staffId: string },
) {
  await namePositions(
    adminUserId,
    orgCode,
    Object.fromEntries(
      DEFAULT_POSITIONS.map((position) => [position.title, signer]),
    ),
  );
  await setApprovalPinForUser(signer.userId, { password: PASSWORD, pin: PIN });
}

/** Sign every remaining box of a leave request as the sole signatory. */
export async function approveLeaveFully(
  signerUserId: string,
  orgCode: string,
  requestId: string,
) {
  for (let step = 0; step < DEFAULT_POSITIONS.length; step += 1) {
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
