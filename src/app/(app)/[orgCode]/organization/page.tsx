import { notFound } from "next/navigation";
import { OrganizationChartClient } from "@/components/organization/organization-chart";
import { loadOrgPage } from "@/lib/org/page";
import { getOrganizationChartForUser } from "@/lib/organization/queries";

export const instant = false;

/** The organisation chart: who holds which position in the company. */
export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ orgCode: string }>;
}) {
  const { session, org } = await loadOrgPage((await params).orgCode);
  const chart = await getOrganizationChartForUser(session.userId, org.code);
  if (!chart) notFound();

  return <OrganizationChartClient orgCode={org.code} initialChart={chart} />;
}
