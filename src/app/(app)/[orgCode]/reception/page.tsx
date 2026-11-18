import { notFound } from "next/navigation";
import { ReceptionClient } from "@/app/(app)/[orgCode]/reception/reception-client";
import { getSession } from "@/lib/auth/session";
import { isReservedOrgCode, normalizeOrgCode } from "@/lib/org/code";
import { resolveOrganizationForUser } from "@/lib/org/queries";
import {
  isReceptionSection,
  type ReceptionSection,
} from "@/lib/reception/sections";
import { listStaffForUser } from "@/lib/staff/queries";
import { listOrgVacationRequestsForUser } from "@/lib/vacation/queries";
import { listVisitorLogsForUser } from "@/lib/visitors/queries";

export const instant = false;

type ReceptionSearch = {
  section?: string | string[];
};

export default async function ReceptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgCode: string }>;
  searchParams: Promise<ReceptionSearch>;
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

  const [staff, vacations, visitors] = await Promise.all([
    listStaffForUser(session.userId, org.code),
    listOrgVacationRequestsForUser(session.userId, org.code),
    listVisitorLogsForUser(session.userId, org.code),
  ]);

  const query = await searchParams;
  const rawSection = Array.isArray(query.section)
    ? query.section[0]
    : query.section;
  const initialSection: ReceptionSection =
    rawSection && isReceptionSection(rawSection) ? rawSection : "vacation";

  return (
    <ReceptionClient
      org={{ id: org.id, name: org.name, code: org.code }}
      staffOptions={staff.map((item) => ({
        id: item.id,
        fullName: item.fullName,
        jobTitle: item.jobTitle,
        status: item.status,
      }))}
      initialVacations={vacations}
      initialVisitors={visitors}
      initialSection={initialSection}
    />
  );
}
