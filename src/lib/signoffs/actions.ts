"use server";

import { runAction } from "@/lib/actions/result";
import { revalidateCompanyPages } from "@/lib/actions/revalidate";
import { requireSession } from "@/lib/auth/session";
import {
  saveSignatureForUser,
  setApprovalPinForUser,
} from "@/lib/signoffs/credentials";
import { setSignatoryForUser } from "@/lib/signoffs/queries";

export async function saveSignatureAction(signatureImage: string | null) {
  return runAction(async () => {
    const session = await requireSession();
    await saveSignatureForUser(session.userId, signatureImage);
  });
}

export async function setApprovalPinAction(input: {
  password: string;
  pin: string;
}) {
  return runAction(async () => {
    const session = await requireSession();
    await setApprovalPinForUser(session.userId, input);
  });
}

export async function setSignatoryAction(
  orgCode: string,
  positionKey: string,
  staffId: string,
) {
  return runAction(async () => {
    const session = await requireSession();
    await setSignatoryForUser(session.userId, orgCode, positionKey, staffId);
    revalidateCompanyPages();
  });
}
