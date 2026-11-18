"use server";

import { runAction } from "@/lib/actions/result";
import { revalidateCompanyPages } from "@/lib/actions/revalidate";
import { requireSession } from "@/lib/auth/session";
import type { SignoffDecision } from "@/lib/signoffs/chains";
import {
  createVacationRequestForUser,
  signVacationRequestForUser,
} from "@/lib/vacation/queries";
import type { VacationRequestInput } from "@/lib/vacation/types";

export async function createVacationRequestAction(
  orgCode: string,
  input: VacationRequestInput,
) {
  return runAction(async () => {
    const session = await requireSession();
    const created = await createVacationRequestForUser(
      session.userId,
      orgCode,
      input,
    );
    revalidateCompanyPages();
    return created;
  });
}

export async function signVacationRequestAction(
  orgCode: string,
  requestId: string,
  input: { pin: string; decision: SignoffDecision; remarks: string },
) {
  return runAction(async () => {
    const session = await requireSession();
    const status = await signVacationRequestForUser(
      session.userId,
      orgCode,
      requestId,
      input,
    );
    revalidateCompanyPages();
    return status;
  });
}
