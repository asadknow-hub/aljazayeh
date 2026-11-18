"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import {
  createOrganizationForUser,
  isOrganizationCodeAvailable,
  listUserOrganizations,
  setDefaultOrganizationForUser,
} from "@/lib/org/queries";
import { normalizeOrgCode, slugCode } from "@/lib/org/code";

export async function getMyOrganizationsAction() {
  const session = await requireSession();
  return listUserOrganizations(session.userId);
}

export async function checkOrgCodeAvailableAction(code: string) {
  await requireSession();
  return isOrganizationCodeAvailable(code);
}

export async function createOrganizationAction(input: {
  name: string;
  code?: string;
}) {
  const session = await requireSession();
  const code =
    normalizeOrgCode(input.code || "") || slugCode(input.name) || "co";
  const org = await createOrganizationForUser(session.userId, {
    name: input.name,
    code,
  });
  revalidatePath("/");
  revalidatePath(`/${org.code}`);
  return {
    id: org.id,
    name: org.name,
    code: org.code,
  };
}

export async function setDefaultOrganizationAction(
  organizationId: string | null,
) {
  const session = await requireSession();
  await setDefaultOrganizationForUser(session.userId, organizationId);
  revalidatePath("/");
}
