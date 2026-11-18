"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import type {
  InquiryCreateInput,
  InquiryUpdateInput,
} from "@/lib/inquiries/types";
import {
  addInquiryCommentForUser,
  approveInquiryStageForUser,
  assignInquiryForUser,
  createInquiryForUser,
  getInquiryForUser,
  getInquiryWorkflowMapForUser,
  listAssignableStaffForDepartment,
  listInquiriesForUser,
  listInvoiceQueueForUser,
  moveInquiryStageForUser,
  saveInquiryWorkflowMapForUser,
  updateInquiryForUser,
} from "@/lib/inquiries/queries";
import type {
  InquiryWorkflowDepartmentKey,
  InquiryWorkflowMap,
} from "@/lib/inquiries/stages";
import { normalizeOrgCode } from "@/lib/org/code";

function revalidateInquiryPaths(orgCode: string, inquiryId?: string) {
  const code = normalizeOrgCode(orgCode);
  revalidatePath(`/${code}`);
  revalidatePath(`/${code}/admin`);
  revalidatePath(`/${code}/sales`);
  revalidatePath(`/${code}/accounts`);
  revalidatePath(`/${code}/engineering`);
  revalidatePath(`/${code}/reception`);
  revalidatePath(`/${code}/company-settings`);
  if (inquiryId) {
    revalidatePath(`/${code}/admin/inquiries/${inquiryId}`);
    revalidatePath(`/${code}/sales/inquiries/${inquiryId}`);
    revalidatePath(`/${code}/accounts/inquiries/${inquiryId}`);
    revalidatePath(`/${code}/engineering/inquiries/${inquiryId}`);
  }
}

export async function getInquiryWorkflowMapAction(orgCode: string) {
  const session = await requireSession();
  return getInquiryWorkflowMapForUser(session.userId, orgCode);
}

export async function saveInquiryWorkflowMapAction(
  orgCode: string,
  input: InquiryWorkflowMap,
) {
  const session = await requireSession();
  const saved = await saveInquiryWorkflowMapForUser(
    session.userId,
    orgCode,
    input,
  );
  revalidateInquiryPaths(orgCode);
  return saved;
}

export async function listInquiriesAction(orgCode: string) {
  const session = await requireSession();
  return listInquiriesForUser(session.userId, orgCode);
}

export async function listInvoiceQueueAction(
  orgCode: string,
  departmentKey: InquiryWorkflowDepartmentKey,
) {
  const session = await requireSession();
  return listInvoiceQueueForUser(session.userId, orgCode, departmentKey);
}

export async function getInquiryAction(orgCode: string, inquiryId: string) {
  const session = await requireSession();
  return getInquiryForUser(session.userId, orgCode, inquiryId);
}

export async function createInquiryAction(
  orgCode: string,
  input: InquiryCreateInput,
) {
  const session = await requireSession();
  const created = await createInquiryForUser(session.userId, orgCode, input, {
    source: "admin",
  });
  revalidateInquiryPaths(orgCode, created.id);
  return created;
}

export async function updateInquiryAction(
  orgCode: string,
  inquiryId: string,
  input: InquiryUpdateInput,
) {
  const session = await requireSession();
  const updated = await updateInquiryForUser(
    session.userId,
    orgCode,
    inquiryId,
    input,
  );
  revalidateInquiryPaths(orgCode, inquiryId);
  return updated;
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
  const session = await requireSession();
  const updated = await assignInquiryForUser(
    session.userId,
    orgCode,
    inquiryId,
    staffId,
  );
  revalidateInquiryPaths(orgCode, inquiryId);
  return updated;
}

export async function moveInquiryStageAction(
  orgCode: string,
  inquiryId: string,
  direction: "previous" | "next",
) {
  const session = await requireSession();
  const updated = await moveInquiryStageForUser(
    session.userId,
    orgCode,
    inquiryId,
    direction,
  );
  revalidateInquiryPaths(orgCode, inquiryId);
  return updated;
}

export async function approveInquiryStageAction(
  orgCode: string,
  inquiryId: string,
) {
  const session = await requireSession();
  const updated = await approveInquiryStageForUser(
    session.userId,
    orgCode,
    inquiryId,
  );
  revalidateInquiryPaths(orgCode, inquiryId);
  return updated;
}

export async function addInquiryCommentAction(
  orgCode: string,
  inquiryId: string,
  body: string,
) {
  const session = await requireSession();
  const updated = await addInquiryCommentForUser(
    session.userId,
    orgCode,
    inquiryId,
    body,
  );
  revalidateInquiryPaths(orgCode, inquiryId);
  return updated;
}
