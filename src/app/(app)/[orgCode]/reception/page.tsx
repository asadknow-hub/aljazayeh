import { can } from "@/lib/access/access";
import { ReceptionClient } from "@/app/(app)/[orgCode]/reception/reception-client";
import { firstParam, loadOrgPage } from "@/lib/org/page";
import {
  isReceptionSection,
  type ReceptionSection,
} from "@/lib/reception/sections";
import { listStaffOptionsForUser } from "@/lib/staff/queries";
import { listOrgVacationRequestsForUser } from "@/lib/vacation/queries";
import { listVisitorLogsForUser } from "@/lib/visitors/queries";

export const instant = false;

export default async function ReceptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgCode: string }>;
  searchParams: Promise<{ section?: string | string[] }>;
}) {
  const { session, org } = await loadOrgPage(
    (await params).orgCode,
    can.useReception,
  );

  const [staff, vacations, visitors] = await Promise.all([
    listStaffOptionsForUser(session.userId, org.code),
    listOrgVacationRequestsForUser(session.userId, org.code),
    listVisitorLogsForUser(session.userId, org.code),
  ]);

  const section = firstParam((await searchParams).section);
  const initialSection: ReceptionSection = isReceptionSection(section)
    ? section
    : "vacation";

  return (
    <ReceptionClient
      org={org}
      staffOptions={staff}
      initialVacations={vacations}
      initialVisitors={visitors}
      initialSection={initialSection}
    />
  );
}
