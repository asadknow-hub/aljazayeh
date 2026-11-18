import { notFound } from "next/navigation";
import { EngineeringClient } from "@/app/(app)/[orgCode]/engineering/engineering-client";
import { getSession } from "@/lib/auth/session";
import {
  isDeptWorkflowSection,
  type DeptWorkflowSection,
} from "@/lib/departments/shell-sections";
import {
  listInquiriesForDepartment,
  listInvoiceQueueForUser,
} from "@/lib/inquiries/queries";
import { isReservedOrgCode, normalizeOrgCode } from "@/lib/org/code";
import { resolveOrganizationForUser } from "@/lib/org/queries";

export const instant = false;

export default async function EngineeringPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgCode: string }>;
  searchParams: Promise<{ section?: string | string[] }>;
}) {
  const session = await getSession();
  if (!session) notFound();

  const { orgCode: rawCode } = await params;
  const orgCode = normalizeOrgCode(rawCode);
  if (!orgCode || isReservedOrgCode(orgCode)) notFound();

  const org = await resolveOrganizationForUser(session.userId, orgCode);
  if (!org) notFound();

  const query = await searchParams;
  const rawSection = Array.isArray(query.section)
    ? query.section[0]
    : query.section;
  const initialSection: DeptWorkflowSection =
    rawSection && isDeptWorkflowSection(rawSection) ? rawSection : "inquiries";

  const [inquiries, invoiceQueue] = await Promise.all([
    listInquiriesForDepartment(session.userId, org.code, "engineering"),
    listInvoiceQueueForUser(session.userId, org.code, "engineering"),
  ]);

  return (
    <EngineeringClient
      org={{ id: org.id, name: org.name, code: org.code }}
      initialSection={initialSection}
      inquiries={inquiries}
      invoiceQueue={invoiceQueue}
    />
  );
}
