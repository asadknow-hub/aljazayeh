import { notFound } from "next/navigation";
import { InquiryDetailClient } from "@/components/inquiries/inquiry-detail-client";
import {
  getInquiryForUser,
  listAssignableStaffForUser,
} from "@/lib/inquiries/queries";
import { isInquiryWorkflowDepartmentKey } from "@/lib/inquiries/stages";
import { loadOrgPage } from "@/lib/org/page";

export const instant = false;

export default async function DepartmentInquiryPage({
  params,
}: {
  params: Promise<{ orgCode: string; dept: string; inquiryId: string }>;
}) {
  const { orgCode, dept, inquiryId } = await params;
  if (!isInquiryWorkflowDepartmentKey(dept)) notFound();

  const { session, org } = await loadOrgPage(orgCode);

  // Returns nothing for inquiries this person is not allowed to see.
  const [inquiry, assignable] = await Promise.all([
    getInquiryForUser(session.userId, org.code, inquiryId),
    listAssignableStaffForUser(session.userId, org.code),
  ]);
  if (!inquiry) notFound();

  return (
    <InquiryDetailClient
      orgCode={org.code}
      initialInquiry={inquiry}
      backHref={`/${org.code}/${dept}?section=inquiries`}
      myStaffId={org.access.staffId}
      assignable={assignable}
    />
  );
}
