import { notFound } from "next/navigation";
import { StaffDetailClient } from "@/app/(app)/[orgCode]/staff/[staffId]/staff-detail-client";
import { firstParam, loadOrgPage } from "@/lib/org/page";
import { getStaffForUser } from "@/lib/staff/queries";
import {
  isStaffDetailSection,
  type StaffDetailSection,
} from "@/lib/staff/types";
import { listStaffVacationRequestsForUser } from "@/lib/vacation/queries";

export const instant = false;

export default async function StaffDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgCode: string; staffId: string }>;
  searchParams: Promise<{ section?: string | string[] }>;
}) {
  const { orgCode, staffId } = await params;
  const { session, org } = await loadOrgPage(orgCode);

  const staff = await getStaffForUser(session.userId, org.code, staffId);
  if (!staff) notFound();

  const vacations = await listStaffVacationRequestsForUser(
    session.userId,
    org.code,
    staffId,
  );

  const section = firstParam((await searchParams).section);
  const initialSection: StaffDetailSection = isStaffDetailSection(section)
    ? section
    : "profile";

  return (
    <StaffDetailClient
      org={org}
      initialStaff={staff}
      initialVacations={vacations}
      initialSection={initialSection}
    />
  );
}
