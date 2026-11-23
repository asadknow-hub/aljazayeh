import { can } from "@/lib/access/access";
import { notFound } from "next/navigation";
import { CompanySettingsClient } from "@/app/(app)/[orgCode]/company-settings/company-settings-client";
import { getCompanySettingsForUser } from "@/lib/company-settings/queries";
import { getInquiryWorkflowMapForUser } from "@/lib/inquiries/queries";
import { getWorkflowChoicesForUser } from "@/lib/organization/queries";
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

  const [settings, workflow, choices] = await Promise.all([
    getCompanySettingsForUser(session.userId, org.code),
    getInquiryWorkflowMapForUser(session.userId, org.code),
    getWorkflowChoicesForUser(session.userId, org.code),
  ]);
  if (!settings || !workflow || !choices) notFound();

  const section = firstParam((await searchParams).section);
  const initialSection =
    section === "inquiry-settings" ? section : "company";

  return (
    <CompanySettingsClient
      initialSettings={settings}
      initialWorkflow={workflow}
      choices={choices}
      initialSection={initialSection}
    />
  );
}
