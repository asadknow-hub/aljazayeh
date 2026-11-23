import { can } from "@/lib/access/access";
import { StaffClient } from "@/app/(app)/[orgCode]/staff/staff-client";
import { loadOrgPage } from "@/lib/org/page";
import { listStaffForUser } from "@/lib/staff/queries";

export const instant = false;

export default async function StaffPage({
  params,
}: {
  params: Promise<{ orgCode: string }>;
}) {
  const { session, org } = await loadOrgPage(
    (await params).orgCode,
    can.manageStaff,
  );
  const staff = await listStaffForUser(session.userId, org.code);

  return (
    <StaffClient
      org={org}
      initialStaff={staff}
      closedDepartments={org.access.closedDepartments}
    />
  );
}
