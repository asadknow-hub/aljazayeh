"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { normalizeOrgCode } from "@/lib/org/code";
import type { VacationRequestInput } from "@/lib/vacation/types";
import {
  createVacationRequestForUser,
  reviewVacationRequestForUser,
} from "@/lib/vacation/queries";

function revalidateVacation(orgCode: string, staffId?: string) {
  const code = normalizeOrgCode(orgCode);
  revalidatePath(`/${code}`);
  revalidatePath(`/${code}/reception`);
  revalidatePath(`/${code}/staff`);
  revalidatePath(`/${code}/all-logs`);
  if (staffId) {
    revalidatePath(`/${code}/staff/${staffId}`);
  }
}

export async function createVacationRequestAction(
  orgCode: string,
  input: VacationRequestInput,
) {
  const session = await requireSession();
  const created = await createVacationRequestForUser(
    session.userId,
    orgCode,
    input,
  );
  revalidateVacation(orgCode, created.staffId);
  return created;
}

export async function approveVacationRequestAction(
  orgCode: string,
  requestId: string,
) {
  const session = await requireSession();
  const updated = await reviewVacationRequestForUser(
    session.userId,
    orgCode,
    requestId,
    "approved",
  );
  revalidateVacation(orgCode, updated.staffId);
  return updated;
}

export async function rejectVacationRequestAction(
  orgCode: string,
  requestId: string,
) {
  const session = await requireSession();
  const updated = await reviewVacationRequestForUser(
    session.userId,
    orgCode,
    requestId,
    "rejected",
  );
  revalidateVacation(orgCode, updated.staffId);
  return updated;
}
