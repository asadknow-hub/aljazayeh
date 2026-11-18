import { AllLogsClient } from "@/app/(app)/[orgCode]/all-logs/all-logs-client";
import { listStaffActivityLogsForUser } from "@/lib/activity/queries";
import { loadOrgPage } from "@/lib/org/page";

export const instant = false;

export default async function AllLogsPage({
  params,
}: {
  params: Promise<{ orgCode: string }>;
}) {
  const { session, org } = await loadOrgPage((await params).orgCode);
  const logs = await listStaffActivityLogsForUser(session.userId, org.code);

  return <AllLogsClient org={org} initialLogs={logs} />;
}
