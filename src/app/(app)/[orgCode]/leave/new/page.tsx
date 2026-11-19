import { notFound } from "next/navigation";
import { LeaveEditor } from "@/components/leave/leave-editor";
import { loadOrgPage } from "@/lib/org/page";
import { getLeaveDraftContextForUser } from "@/lib/vacation/queries";

export const instant = false;

/** Raise a leave request: its details beside the form they fill in. */
export default async function NewLeaveRequestPage({
  params,
}: {
  params: Promise<{ orgCode: string }>;
}) {
  const { session, org } = await loadOrgPage((await params).orgCode);

  // Returns nothing for people who may not raise leave requests.
  const context = await getLeaveDraftContextForUser(session.userId, org.code);
  if (!context) notFound();

  return (
    <LeaveEditor
      orgCode={org.code}
      context={context}
      now={new Date().toISOString()}
      listHref={`/${org.code}/reception?section=vacation`}
    />
  );
}
