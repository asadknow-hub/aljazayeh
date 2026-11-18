import { notFound } from "next/navigation";
import { AllLogsClient } from "@/app/(app)/[orgCode]/all-logs/all-logs-client";
import { listStaffActivityLogsForUser } from "@/lib/activity/queries";
import { getSession } from "@/lib/auth/session";
import { isReservedOrgCode, normalizeOrgCode } from "@/lib/org/code";
import { resolveOrganizationForUser } from "@/lib/org/queries";

export const instant = false;

export default async function AllLogsPage({
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

  const logs = await listStaffActivityLogsForUser(session.userId, org.code);

  return (
    <AllLogsClient
      org={{ id: org.id, name: org.name, code: org.code }}
      initialLogs={logs}
    />
  );
}
