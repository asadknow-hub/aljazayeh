import { can } from "@/lib/access/access";
import { notFound } from "next/navigation";
import { CompanySettingsClient } from "@/app/(app)/[orgCode]/company-settings/company-settings-client";
import { getCompanySettingsForUser } from "@/lib/company-settings/queries";
import { getInquiryWorkflowMapForUser } from "@/lib/inquiries/queries";
import { getSignatoriesForUser } from "@/lib/signoffs/queries";
import { firstParam, loadOrgPage } from "@/lib/org/page";

export const instant = false;

export default async function CompanySettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgCode: string }>;
  searchParams: Promise<{ section?: string | string[] }>;
}) {
  const { session, org } = await loadOrgPage(
    (await params).orgCode,
    can.manageCompany,
  );

  const [settings, workflow, signatories] = await Promise.all([
    getCompanySettingsForUser(session.userId, org.code),
    getInquiryWorkflowMapForUser(session.userId, org.code),
    getSignatoriesForUser(session.userId, org.code),
  ]);
  if (!settings || !workflow || !signatories) notFound();

  const section = firstParam((await searchParams).section);
  const initialSection =
    section === "inquiry-settings" || section === "signatories"
      ? section
      : "company";

  return (
    <CompanySettingsClient
      initialSettings={settings}
      initialWorkflow={workflow}
      initialSignatories={signatories}
      initialSection={initialSection}
    />
  );
}
