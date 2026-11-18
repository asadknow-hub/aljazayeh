import { can } from "@/lib/access/access";
import { notFound } from "next/navigation";
import { DepartmentWorkspace } from "@/components/departments/department-workspace";
import {
  departmentSections,
  type DepartmentSection,
} from "@/lib/departments/sections";
import { formTypesRaisedIn } from "@/lib/forms/definitions";
import { listApprovalFormsForUser } from "@/lib/forms/queries";
import {
  listInquiriesForDepartment,
  listInquiriesForUser,
  listInvoiceQueueForUser,
} from "@/lib/inquiries/queries";
import { isInquiryWorkflowDepartmentKey } from "@/lib/inquiries/stages";
import { firstParam, loadOrgPage } from "@/lib/org/page";

export const instant = false;

/** Workspace for a department that handles inquiry stages (Admin, Sales, …). */
export default async function DepartmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgCode: string; dept: string }>;
  searchParams: Promise<{ section?: string | string[] }>;
}) {
  const { orgCode, dept } = await params;
  if (!isInquiryWorkflowDepartmentKey(dept)) notFound();

  const { session, org } = await loadOrgPage(orgCode, (access) =>
    can.openDepartment(access, dept),
  );

  const section = firstParam((await searchParams).section);
  const initialSection: DepartmentSection =
    departmentSections(dept).find((item) => item.key === section)?.key ??
    "inquiries";

  // The Admin workspace shows the full pipeline; others what they own.
  const formTypes = formTypesRaisedIn(dept);
  const [inquiries, invoiceQueue, ...formLists] = await Promise.all([
    dept === "admin"
      ? listInquiriesForUser(session.userId, org.code)
      : listInquiriesForDepartment(session.userId, org.code, dept),
    listInvoiceQueueForUser(session.userId, org.code, dept),
    ...formTypes.map((type) =>
      listApprovalFormsForUser(session.userId, org.code, type),
    ),
  ]);

  return (
    <DepartmentWorkspace
      org={org}
      departmentKey={dept}
      initialSection={initialSection}
      inquiries={inquiries}
      invoiceQueue={invoiceQueue}
      forms={Object.fromEntries(
        formTypes.map((type, index) => [type, formLists[index]]),
      )}
    />
  );
}
