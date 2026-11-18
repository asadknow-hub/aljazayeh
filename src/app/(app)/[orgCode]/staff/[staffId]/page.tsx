import { notFound } from "next/navigation";
import { StaffDetailClient } from "@/app/(app)/[orgCode]/staff/[staffId]/staff-detail-client";
import { getSession } from "@/lib/auth/session";
import { isReservedOrgCode, normalizeOrgCode } from "@/lib/org/code";
import { resolveOrganizationForUser } from "@/lib/org/queries";
import { getStaffForUser } from "@/lib/staff/queries";
import {
  isStaffDetailSection,
  type StaffDetailSection,
} from "@/lib/staff/types";
import { listStaffVacationRequestsForUser } from "@/lib/vacation/queries";

export const instant = false;

type StaffDetailSearch = {
  section?: string | string[];
};

export default async function StaffDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgCode: string; staffId: string }>;
  searchParams: Promise<StaffDetailSearch>;
}) {
  const session = await getSession();
  if (!session) {
    notFound();
  }

  const { orgCode: rawCode, staffId } = await params;
  const orgCode = normalizeOrgCode(rawCode);

  if (!orgCode || isReservedOrgCode(orgCode) || !staffId) {
    notFound();
  }

  const org = await resolveOrganizationForUser(session.userId, orgCode);
  if (!org) {
    notFound();
  }

  const staff = await getStaffForUser(session.userId, org.code, staffId);
  if (!staff) {
    notFound();
  }

  const vacations = await listStaffVacationRequestsForUser(
    session.userId,
    org.code,
    staffId,
  );

  const query = await searchParams;
  const rawSection = Array.isArray(query.section)
    ? query.section[0]
    : query.section;
  const initialSection: StaffDetailSection =
    rawSection && isStaffDetailSection(rawSection) ? rawSection : "profile";

  return (
    <StaffDetailClient
      org={{ id: org.id, name: org.name, code: org.code }}
      initialStaff={staff}
      initialVacations={vacations}
      initialSection={initialSection}
    />
  );
}
