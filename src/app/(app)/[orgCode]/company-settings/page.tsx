import { notFound } from "next/navigation";
import { CompanySettingsClient } from "@/app/(app)/[orgCode]/company-settings/company-settings-client";
import { getCompanySettingsForUser } from "@/lib/company-settings/queries";
import { getInquiryWorkflowMapForUser } from "@/lib/inquiries/queries";
import { firstParam, loadOrgPage } from "@/lib/org/page";

export const instant = false;

export default async function CompanySettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgCode: string }>;
  searchParams: Promise<{ section?: string | string[] }>;
}) {
  const { session, org } = await loadOrgPage((await params).orgCode);

  const [settings, workflow] = await Promise.all([
    getCompanySettingsForUser(session.userId, org.code),
    getInquiryWorkflowMapForUser(session.userId, org.code),
  ]);
  if (!settings || !workflow) notFound();

  const initialSection =
    firstParam((await searchParams).section) === "inquiry-settings"
      ? "inquiry-settings"
      : "company";

  return (
    <CompanySettingsClient
      initialSettings={settings}
      initialWorkflow={workflow}
      initialSection={initialSection}
    />
  );
}
