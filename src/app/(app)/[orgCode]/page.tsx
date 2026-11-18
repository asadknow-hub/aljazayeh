import { CompanyHomeClient } from "@/app/(app)/[orgCode]/company-home-client";
import { can, canOpenTile } from "@/lib/access/access";
import { DEPARTMENTS } from "@/lib/departments/catalog";
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

  return (
    <CompanyHomeClient
      org={org}
      tiles={DEPARTMENTS.filter((dept) => canOpenTile(org.access, dept.key))}
      canReviewLeave={can.reviewLeave(org.access)}
      pendingVacations={pendingVacations}
    />
  );
}
