import { notFound } from "next/navigation";
import { CompanySettingsClient } from "@/app/(app)/[orgCode]/company-settings/company-settings-client";
import { getSession } from "@/lib/auth/session";
import { getCompanySettingsForUser } from "@/lib/company-settings/queries";
import { getInquiryWorkflowMapForUser } from "@/lib/inquiries/queries";
import { isReservedOrgCode, normalizeOrgCode } from "@/lib/org/code";

export const instant = false;

type SettingsSearch = {
  section?: string | string[];
};

export default async function CompanySettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgCode: string }>;
  searchParams: Promise<SettingsSearch>;
}) {
  const session = await getSession();
  if (!session) {
    notFound();
  }

  const { orgCode: rawCode } = await params;
  const orgCode = normalizeOrgCode(rawCode);

  if (!orgCode || isReservedOrgCode(orgCode)) {
    notFound();
  }

  const [settings, workflow] = await Promise.all([
    getCompanySettingsForUser(session.userId, orgCode),
    getInquiryWorkflowMapForUser(session.userId, orgCode),
  ]);

  if (!settings || !workflow) {
    notFound();
  }

  const query = await searchParams;
  const rawSection = Array.isArray(query.section)
    ? query.section[0]
    : query.section;
  const initialSection =
    rawSection === "inquiry-settings" ? "inquiry-settings" : "company";

  return (
    <CompanySettingsClient
      initialSettings={settings}
      initialWorkflow={workflow}
      initialSection={initialSection}
    />
  );
}
