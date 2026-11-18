import { notFound } from "next/navigation";
import { CompanyHomeClient } from "@/app/(app)/[orgCode]/company-home-client";
import { getSession } from "@/lib/auth/session";
import { isReservedOrgCode, normalizeOrgCode } from "@/lib/org/code";
import { resolveOrganizationForUser } from "@/lib/org/queries";
import { listPendingVacationRequestsForUser } from "@/lib/vacation/queries";

export const instant = false;

export default async function CompanyPage({
  params,
}: PageProps<"/[orgCode]">) {
  const session = await getSession();
  if (!session) {
    notFound();
  }

  const { orgCode: rawCode } = await params;
  const orgCode = normalizeOrgCode(rawCode);

  if (!orgCode || isReservedOrgCode(orgCode)) {
    notFound();
  }

  const org = await resolveOrganizationForUser(session.userId, orgCode);
  if (!org) {
    notFound();
  }

  const pendingVacations = await listPendingVacationRequestsForUser(
    session.userId,
    org.code,
  );

  return (
    <CompanyHomeClient
      org={{
        id: org.id,
        name: org.name,
        code: org.code,
      }}
      pendingVacations={pendingVacations}
    />
  );
}
