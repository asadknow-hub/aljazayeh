"use server";

import { runAction } from "@/lib/actions/result";
import { revalidateCompanyPages } from "@/lib/actions/revalidate";
import { requireSession } from "@/lib/auth/session";
import { createVisitorLogForUser } from "@/lib/visitors/queries";
import type { VisitorLogInput } from "@/lib/visitors/types";

export async function createVisitorLogAction(
  orgCode: string,
  input: VisitorLogInput,
) {
  return runAction(async () => {
    const session = await requireSession();
    const created = await createVisitorLogForUser(
      session.userId,
      orgCode,
      input,
    );
    revalidateCompanyPages();
    return created;
  });
}
