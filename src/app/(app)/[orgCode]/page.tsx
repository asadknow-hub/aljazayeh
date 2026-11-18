import { CompanyHomeClient } from "@/app/(app)/[orgCode]/company-home-client";
import { loadOrgPage } from "@/lib/org/page";
import { listPendingVacationRequestsForUser } from "@/lib/vacation/queries";

export const instant = false;

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ orgCode: string }>;
}) {
  const { session, org } = await loadOrgPage((await params).orgCode);

  const pendingVacations = await listPendingVacationRequestsForUser(
    session.userId,
    org.code,
  );

  return <CompanyHomeClient org={org} pendingVacations={pendingVacations} />;
}
