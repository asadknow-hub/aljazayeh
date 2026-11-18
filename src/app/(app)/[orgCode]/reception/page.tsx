import { can } from "@/lib/access/access";
import { notFound } from "next/navigation";
import { ReceptionClient } from "@/app/(app)/[orgCode]/reception/reception-client";
import { getAttendanceDayForUser } from "@/lib/attendance/queries";
import { appDateValue } from "@/lib/datetime/format";
import { formTypesRaisedIn } from "@/lib/forms/definitions";
import { listApprovalFormsForUser } from "@/lib/forms/queries";
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

  const today = appDateValue();
  const formTypes = formTypesRaisedIn("reception");
  const [staff, vacations, visitors, attendance, ...formLists] =
    await Promise.all([
      listStaffOptionsForUser(session.userId, org.code),
      listOrgVacationRequestsForUser(session.userId, org.code),
      listVisitorLogsForUser(session.userId, org.code),
      getAttendanceDayForUser(session.userId, org.code, today),
      ...formTypes.map((type) =>
        listApprovalFormsForUser(session.userId, org.code, type),
      ),
    ]);
  if (!attendance) notFound();

  const section = firstParam((await searchParams).section);
  const initialSection: ReceptionSection = isReceptionSection(section)
    ? section
    : "attendance";

  return (
    <ReceptionClient
      org={org}
      staffOptions={staff}
      initialVacations={vacations}
      initialVisitors={visitors}
      forms={Object.fromEntries(
        formTypes.map((type, index) => [type, formLists[index]]),
      )}
      initialAttendance={attendance}
      today={today}
      initialSection={initialSection}
    />
  );
}
