"use server";

import { runAction } from "@/lib/actions/result";
import { revalidateCompanyPages } from "@/lib/actions/revalidate";
import { requireSession } from "@/lib/auth/session";
import {
  createVacationRequestForUser,
  reviewVacationRequestForUser,
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

export async function reviewVacationRequestAction(
  orgCode: string,
  requestId: string,
  decision: "approved" | "rejected",
) {
  return runAction(async () => {
    const session = await requireSession();
    const updated = await reviewVacationRequestForUser(
      session.userId,
      orgCode,
      requestId,
      decision,
    );
    revalidateCompanyPages();
    return updated;
  });
}
