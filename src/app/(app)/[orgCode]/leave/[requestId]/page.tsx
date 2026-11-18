import { notFound } from "next/navigation";
import { LeaveActions } from "@/app/(app)/[orgCode]/leave/[requestId]/leave-actions";
import { LeaveForm } from "@/components/leave/leave-form";
import { loadOrgPage } from "@/lib/org/page";
import { getLeaveDocumentForUser } from "@/lib/vacation/queries";

export const instant = false;

/** A leave request as its form: on screen exactly as it prints. */
export default async function LeaveRequestPage({
  params,
}: {
  params: Promise<{ orgCode: string; requestId: string }>;
}) {
  const { orgCode, requestId } = await params;
  const { session, org } = await loadOrgPage(orgCode);

  // Returns nothing for people who have no business with this request.
  const leave = await getLeaveDocumentForUser(
    session.userId,
    org.code,
    requestId,
  );
  if (!leave) notFound();

  return (
    <main className="flex-1 p-4 sm:p-6 print:p-0">
      <LeaveActions
        orgCode={org.code}
        requestId={leave.id}
        signoffs={leave.signoffs}
      />
      <LeaveForm leave={leave} />
    </main>
  );
}
