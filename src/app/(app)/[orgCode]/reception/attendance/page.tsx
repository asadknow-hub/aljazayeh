import { notFound } from "next/navigation";
import { AttendanceSheetView } from "@/components/attendance/attendance-sheet";
import { SheetToolbar } from "@/components/attendance/sheet-toolbar";
import { can } from "@/lib/access/access";
import { getAttendanceSheetForUser } from "@/lib/attendance/queries";
import {
  isAttendanceGroup,
  isIsoMonth,
  type AttendanceGroup,
} from "@/lib/attendance/types";
import { appDateValue } from "@/lib/datetime/format";
import { firstParam, loadOrgPage } from "@/lib/org/page";

export const instant = false;

/** The monthly Employee Attendance Sheet: on screen exactly as it prints. */
export default async function AttendanceSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgCode: string }>;
  searchParams: Promise<{
    month?: string | string[];
    group?: string | string[];
  }>;
}) {
  const { session, org } = await loadOrgPage(
    (await params).orgCode,
    can.useReception,
  );

  const query = await searchParams;
  const requestedMonth = firstParam(query.month);
  const requestedGroup = firstParam(query.group);
  const month = isIsoMonth(requestedMonth)
    ? requestedMonth
    : appDateValue().slice(0, 7);
  const group: AttendanceGroup = isAttendanceGroup(requestedGroup)
    ? requestedGroup
    : "workers";

  const sheet = await getAttendanceSheetForUser(
    session.userId,
    org.code,
    month,
    group,
  );
  if (!sheet) notFound();

  return (
    <main className="flex-1 p-4 sm:p-6 print:p-0">
      <SheetToolbar
        basePath={`/${org.code}/reception/attendance`}
        backHref={`/${org.code}/reception?section=attendance`}
        month={month}
        group={group}
      />
      <div className="overflow-x-auto border border-zinc-300 bg-white p-3 print:overflow-visible print:border-0 print:p-0">
        <AttendanceSheetView sheet={sheet} />
      </div>
    </main>
  );
}
