"use server";

import { runAction } from "@/lib/actions/result";
import { requireSession } from "@/lib/auth/session";
import {
  saveSignatureForUser,
  setApprovalPinForUser,
} from "@/lib/signoffs/credentials";

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
