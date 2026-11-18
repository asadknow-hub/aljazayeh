"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { normalizeOrgCode } from "@/lib/org/code";
import type { VisitorLogInput } from "@/lib/visitors/types";
import {
  createVisitorLogForUser,
  listVisitorLogsForUser,
} from "@/lib/visitors/queries";

function revalidateVisitors(orgCode: string) {
  const code = normalizeOrgCode(orgCode);
  revalidatePath(`/${code}/reception`);
  revalidatePath(`/${code}/admin`);
  revalidatePath(`/${code}/sales`);
  revalidatePath(`/${code}/accounts`);
  revalidatePath(`/${code}/engineering`);
}

export async function listVisitorLogsAction(orgCode: string) {
  const session = await requireSession();
  return listVisitorLogsForUser(session.userId, orgCode);
}

export async function createVisitorLogAction(
  orgCode: string,
  input: VisitorLogInput,
) {
  const session = await requireSession();
  const created = await createVisitorLogForUser(session.userId, orgCode, input);
  revalidateVisitors(orgCode);
  return created;
}
