import { notFound } from "next/navigation";
import { InquiryDetailClient } from "@/components/inquiries/inquiry-detail-client";
import { getSession } from "@/lib/auth/session";
import { getInquiryForUser } from "@/lib/inquiries/queries";
import { isReservedOrgCode, normalizeOrgCode } from "@/lib/org/code";
import { resolveOrganizationForUser } from "@/lib/org/queries";

export const instant = false;

export default async function EngineeringInquiryDetailPage({
  params,
}: {
  params: Promise<{ orgCode: string; inquiryId: string }>;
}) {
  const session = await getSession();
  if (!session) notFound();

  const { orgCode: rawCode, inquiryId } = await params;
  const orgCode = normalizeOrgCode(rawCode);
  if (!orgCode || isReservedOrgCode(orgCode) || !inquiryId) notFound();

  const org = await resolveOrganizationForUser(session.userId, orgCode);
  if (!org) notFound();

  const inquiry = await getInquiryForUser(session.userId, org.code, inquiryId);
  if (!inquiry || inquiry.owningDepartmentKey !== "engineering") notFound();

  return (
    <InquiryDetailClient
      orgCode={org.code}
      initialInquiry={inquiry}
      backHref={`/${org.code}/engineering?section=inquiries`}
    />
  );
}
