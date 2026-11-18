"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { requireSession } from "@/lib/auth/session";
import { normalizeOrgCode, slugCode } from "@/lib/org/code";
import {
  createOrganizationForUser,
  isOrganizationCodeAvailable,
  setDefaultOrganizationForUser,
} from "@/lib/org/queries";

export async function checkOrgCodeAvailableAction(code: string) {
  await requireSession();
  return isOrganizationCodeAvailable(code);
}

export async function createOrganizationAction(input: {
  name: string;
  code?: string;
}) {
  return runAction(async () => {
    const session = await requireSession();
    const code =
      normalizeOrgCode(input.code || "") || slugCode(input.name) || "co";
    const org = await createOrganizationForUser(session.userId, {
      name: input.name,
      code,
    });
    revalidatePath("/");
    revalidatePath(`/${org.code}`);
    return org;
  });
}

export async function setDefaultOrganizationAction(
  organizationId: string | null,
) {
  return runAction(async () => {
    const session = await requireSession();
    await setDefaultOrganizationForUser(session.userId, organizationId);
    revalidatePath("/");
  });
}
