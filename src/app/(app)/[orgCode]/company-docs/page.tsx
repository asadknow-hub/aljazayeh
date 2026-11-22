import { notFound } from "next/navigation";
import { CompanyDocsClient } from "@/components/company-docs/company-docs-client";
import { getCompanyDocsForUser } from "@/lib/company-docs/queries";
import { loadOrgPage } from "@/lib/org/page";

export const instant = false;

/** Every paper the company prepares, and where each is used. */
export default async function CompanyDocsPage({
  params,
}: {
  params: Promise<{ orgCode: string }>;
}) {
  const { session, org } = await loadOrgPage((await params).orgCode);
  const overview = await getCompanyDocsForUser(session.userId, org.code);
  if (!overview) notFound();

  return <CompanyDocsClient orgCode={org.code} overview={overview} />;
}
