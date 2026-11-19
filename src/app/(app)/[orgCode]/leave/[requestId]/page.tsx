import { notFound } from "next/navigation";
import { DocumentSplit } from "@/components/documents/document-split";
import { LeaveForm } from "@/components/leave/leave-form";
import { ApprovalPanel } from "@/components/signoffs/approval-panel";
import { can } from "@/lib/access/access";
import { formatLeavePeriod } from "@/lib/datetime/format";
import { loadOrgPage } from "@/lib/org/page";
import { signVacationRequestAction } from "@/lib/vacation/actions";
import { getLeaveDocumentForUser } from "@/lib/vacation/queries";

export const instant = false;

/** A leave request: where its approval stands, beside the form itself. */
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
    <DocumentSplit
      // Someone who only signs it came from their tasks on the home screen.
      backHref={
        can.useReception(org.access)
          ? `/${org.code}/reception?section=vacation`
          : `/${org.code}`
      }
      printLabel="Print"
      side={
        <ApprovalPanel
          title="Leave Request"
          reference={`${leave.staffName} · ${formatLeavePeriod(leave.startDate, leave.endDate, leave.dayCount)}`}
          signoffs={leave.signoffs}
          onSign={signVacationRequestAction.bind(null, org.code, leave.id)}
        />
      }
    >
      <LeaveForm leave={leave} />
    </DocumentSplit>
  );
}
