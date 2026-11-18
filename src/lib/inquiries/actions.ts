"use server";

import { runAction } from "@/lib/actions/result";
import { revalidateCompanyPages } from "@/lib/actions/revalidate";
import { requireSession } from "@/lib/auth/session";
import {
  addInquiryCommentForUser,
  approveInquiryStageForUser,
  assignInquiryForUser,
  createInquiryForUser,
  listAssignableStaffForDepartment,
  moveInquiryStageForUser,
  saveInquiryWorkflowMapForUser,
  updateInquiryForUser,
} from "@/lib/inquiries/queries";
import type {
  InquiryWorkflowDepartmentKey,
  InquiryWorkflowMap,
} from "@/lib/inquiries/stages";
import type {
  InquiryCreateInput,
  InquiryUpdateInput,
} from "@/lib/inquiries/types";

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
  input: InquiryCreateInput,
) {
  return runAction(async () => {
    const session = await requireSession();
    const created = await createInquiryForUser(session.userId, orgCode, input);
    revalidateCompanyPages();
    return created;
  });
}

export async function updateInquiryAction(
  orgCode: string,
  inquiryId: string,
  input: InquiryUpdateInput,
) {
  return runAction(async () => {
    const session = await requireSession();
    const updated = await updateInquiryForUser(
      session.userId,
      orgCode,
      inquiryId,
      input,
    );
    revalidateCompanyPages();
    return updated;
  });
}

export async function listAssignableStaffAction(
  orgCode: string,
  departmentKey: InquiryWorkflowDepartmentKey,
) {
  const session = await requireSession();
  return listAssignableStaffForDepartment(
    session.userId,
    orgCode,
    departmentKey,
  );
}

export async function assignInquiryAction(
  orgCode: string,
  inquiryId: string,
  staffId: string,
) {
  return runAction(async () => {
    const session = await requireSession();
    const updated = await assignInquiryForUser(
      session.userId,
      orgCode,
      inquiryId,
      staffId,
    );
    revalidateCompanyPages();
    return updated;
  });
}

export async function moveInquiryStageAction(
  orgCode: string,
  inquiryId: string,
  direction: "previous" | "next",
) {
  return runAction(async () => {
    const session = await requireSession();
    const updated = await moveInquiryStageForUser(
      session.userId,
      orgCode,
      inquiryId,
      direction,
    );
    revalidateCompanyPages();
    return updated;
  });
}

export async function approveInquiryStageAction(
  orgCode: string,
  inquiryId: string,
) {
  return runAction(async () => {
    const session = await requireSession();
    const updated = await approveInquiryStageForUser(
      session.userId,
      orgCode,
      inquiryId,
    );
    revalidateCompanyPages();
    return updated;
  });
}

export async function addInquiryCommentAction(
  orgCode: string,
  inquiryId: string,
  body: string,
) {
  return runAction(async () => {
    const session = await requireSession();
    const updated = await addInquiryCommentForUser(
      session.userId,
      orgCode,
      inquiryId,
      body,
    );
    revalidateCompanyPages();
    return updated;
  });
}
