"use server";

import { runAction } from "@/lib/actions/result";
import { revalidateCompanyPages } from "@/lib/actions/revalidate";
import { requireSession } from "@/lib/auth/session";
import {
  addInquiryCommentForUser,
  approveInquiryStageForUser,
  assignInquiryForUser,
  planInquiryStepForUser,
  closeInquiryForUser,
  createInquiryForUser,
  reopenInquiryForUser,
  reopenInquiryStepForUser,
  requestInquiryApprovalForUser,
  saveInquiryStageForUser,
  saveInquiryWorkflowMapForUser,
  sendInquiryBackForUser,
  uploadInquiryAttachmentForUser,
} from "@/lib/inquiries/queries";
import type { InquiryWorkflowMap } from "@/lib/inquiries/stages";
import type { InquiryStageInput, InquiryView } from "@/lib/inquiries/types";

/** Run one change to an inquiry as the signed-in person. */
function inquiryAction(work: (userId: string) => Promise<InquiryView>) {
  return runAction(async () => {
    const session = await requireSession();
    const updated = await work(session.userId);
    revalidateCompanyPages();
    return updated;
  });
}

export async function saveInquiryWorkflowMapAction(
  orgCode: string,
  input: InquiryWorkflowMap,
) {
  return runAction(async () => {
    const session = await requireSession();
    const saved = await saveInquiryWorkflowMapForUser(
      session.userId,
      orgCode,
      input,
    );
    revalidateCompanyPages();
    return saved;
  });
}

export async function createInquiryAction(
  orgCode: string,
  input: InquiryStageInput,
) {
  return inquiryAction((userId) =>
    createInquiryForUser(userId, orgCode, input),
  );
}

/** Save the current step; with `complete`, also move on to the next one. */
export async function saveInquiryStageAction(
  orgCode: string,
  inquiryId: string,
  input: InquiryStageInput,
  complete: boolean,
) {
  return inquiryAction((userId) =>
    saveInquiryStageForUser(userId, orgCode, inquiryId, input, { complete }),
  );
}

export async function sendInquiryBackAction(
  orgCode: string,
  inquiryId: string,
  reason: string,
) {
  return inquiryAction((userId) =>
    sendInquiryBackForUser(userId, orgCode, inquiryId, reason),
  );
}

export async function assignInquiryAction(
  orgCode: string,
  inquiryId: string,
  staffId: string,
) {
  return inquiryAction((userId) =>
    assignInquiryForUser(userId, orgCode, inquiryId, staffId),
  );
}

export async function planInquiryStepAction(
  orgCode: string,
  inquiryId: string,
  stage: string,
  staffId: string,
) {
  return inquiryAction((userId) =>
    planInquiryStepForUser(userId, orgCode, inquiryId, stage, staffId),
  );
}

export async function approveInquiryStageAction(
  orgCode: string,
  inquiryId: string,
) {
  return inquiryAction((userId) =>
    approveInquiryStageForUser(userId, orgCode, inquiryId),
  );
}

export async function addInquiryCommentAction(
  orgCode: string,
  inquiryId: string,
  body: string,
) {
  return inquiryAction((userId) =>
    addInquiryCommentForUser(userId, orgCode, inquiryId, body),
  );
}

export async function closeInquiryAction(
  orgCode: string,
  inquiryId: string,
  reason: string,
) {
  return inquiryAction((userId) =>
    closeInquiryForUser(userId, orgCode, inquiryId, reason),
  );
}

export async function reopenInquiryAction(orgCode: string, inquiryId: string) {
  return inquiryAction((userId) =>
    reopenInquiryForUser(userId, orgCode, inquiryId),
  );
}

/** Save the current step and send it to whoever must approve it. */
export async function requestInquiryApprovalAction(
  orgCode: string,
  inquiryId: string,
  input: InquiryStageInput,
) {
  return inquiryAction((userId) =>
    requestInquiryApprovalForUser(userId, orgCode, inquiryId, input),
  );
}

/** Take the current step back from approval so it can be changed. */
export async function reopenInquiryStepAction(
  orgCode: string,
  inquiryId: string,
  reason: string,
) {
  return inquiryAction((userId) =>
    reopenInquiryStepForUser(userId, orgCode, inquiryId, reason),
  );
}

/** Upload a file to the current step of an inquiry. */
export async function uploadInquiryAttachmentAction(
  orgCode: string,
  inquiryId: string,
  input: { fileName: string; dataUrl: string },
) {
  return runAction(async () => {
    const session = await requireSession();
    return uploadInquiryAttachmentForUser(
      session.userId,
      orgCode,
      inquiryId,
      input,
    );
  });
}
