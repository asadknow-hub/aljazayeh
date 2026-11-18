import { notFound } from "next/navigation";
import { AccountsClient } from "@/app/(app)/[orgCode]/accounts/accounts-client";
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

export default async function AccountsPage({
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
    listInquiriesForDepartment(session.userId, org.code, "accounts"),
    listInvoiceQueueForUser(session.userId, org.code, "accounts"),
  ]);

  return (
    <AccountsClient
      org={{ id: org.id, name: org.name, code: org.code }}
      initialSection={initialSection}
      inquiries={inquiries}
      invoiceQueue={invoiceQueue}
    />
  );
}
