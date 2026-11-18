import { notFound } from "next/navigation";
import { InquiryDetailClient } from "@/components/inquiries/inquiry-detail-client";
import { getInquiryForUser } from "@/lib/inquiries/queries";
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
  const inquiry = await getInquiryForUser(session.userId, org.code, inquiryId);
  if (!inquiry) notFound();
  // The Admin workspace lists every inquiry; others only the ones they own.
  if (dept !== "admin" && inquiry.owningDepartmentKey !== dept) notFound();

  return (
    <InquiryDetailClient
      orgCode={org.code}
      initialInquiry={inquiry}
      backHref={`/${org.code}/${dept}?section=inquiries`}
    />
  );
}
