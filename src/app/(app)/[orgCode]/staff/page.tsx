import { notFound } from "next/navigation";
import { StaffClient } from "@/app/(app)/[orgCode]/staff/staff-client";
import { getSession } from "@/lib/auth/session";
import { isReservedOrgCode, normalizeOrgCode } from "@/lib/org/code";
import { resolveOrganizationForUser } from "@/lib/org/queries";
import { listStaffForUser } from "@/lib/staff/queries";

export const instant = false;

export default async function StaffPage({
  params,
}: {
  params: Promise<{ orgCode: string }>;
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

  const org = await resolveOrganizationForUser(session.userId, orgCode);
  if (!org) {
    notFound();
  }

  const staff = await listStaffForUser(session.userId, org.code);

  return (
    <StaffClient
      org={{ id: org.id, name: org.name, code: org.code }}
      initialStaff={staff}
    />
  );
}
