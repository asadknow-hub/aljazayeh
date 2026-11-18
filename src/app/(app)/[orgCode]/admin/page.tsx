import { notFound } from "next/navigation";
import { AdminClient } from "@/app/(app)/[orgCode]/admin/admin-client";
import { getSession } from "@/lib/auth/session";
import {
  isAdminSection,
  type AdminSection,
} from "@/lib/departments/shell-sections";
import {
  listInquiriesForUser,
  listInvoiceQueueForUser,
} from "@/lib/inquiries/queries";
import { isReservedOrgCode, normalizeOrgCode } from "@/lib/org/code";
import { resolveOrganizationForUser } from "@/lib/org/queries";

export const instant = false;

type AdminSearch = {
  section?: string | string[];
};

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgCode: string }>;
  searchParams: Promise<AdminSearch>;
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
  const initialSection: AdminSection =
    rawSection && isAdminSection(rawSection) ? rawSection : "inquiries";

  const [inquiries, invoiceQueue] = await Promise.all([
    listInquiriesForUser(session.userId, org.code),
    listInvoiceQueueForUser(session.userId, org.code, "admin"),
  ]);

  return (
    <AdminClient
      org={{ id: org.id, name: org.name, code: org.code }}
      initialSection={initialSection}
      inquiries={inquiries}
      invoiceQueue={invoiceQueue}
    />
  );
}
