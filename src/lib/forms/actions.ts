"use server";

import { runAction } from "@/lib/actions/result";
import { revalidateCompanyPages } from "@/lib/actions/revalidate";
import { requireSession } from "@/lib/auth/session";
import type { ApprovalFormInput, FormType } from "@/lib/forms/definitions";
import {
  createApprovalFormForUser,
  signApprovalFormForUser,
} from "@/lib/forms/queries";
import type { SignoffDecision } from "@/lib/signoffs/chains";

export async function createApprovalFormAction(
  orgCode: string,
  type: FormType,
  input: ApprovalFormInput,
) {
  return runAction(async () => {
    const session = await requireSession();
    const created = await createApprovalFormForUser(
      session.userId,
      orgCode,
      type,
      input,
    );
    revalidateCompanyPages();
    return created;
  });
}

export async function signApprovalFormAction(
  orgCode: string,
  formId: string,
  input: { pin: string; decision: SignoffDecision; remarks: string },
) {
  return runAction(async () => {
    const session = await requireSession();
    const status = await signApprovalFormForUser(
      session.userId,
      orgCode,
      formId,
      input,
    );
    revalidateCompanyPages();
    return status;
  });
}
