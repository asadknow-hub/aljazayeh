import { notFound } from "next/navigation";
import { CompanyDocEditor } from "@/components/company-docs/company-doc-editor";
import { getCompanyDocForUser } from "@/lib/company-docs/queries";
import { getCompanyLetterheadForUser } from "@/lib/company-settings/queries";
import { appDateValue } from "@/lib/datetime/format";
import { loadOrgPage } from "@/lib/org/page";

export const instant = false;

/** One paper of the inquiry process: where it is used, and its settings. */
export default async function CompanyDocPage({
  params,
}: {
  params: Promise<{ orgCode: string; stage: string; document: string }>;
}) {
  const { orgCode, stage, document } = await params;
  const { session, org } = await loadOrgPage(orgCode);

  const [detail, company] = await Promise.all([
    getCompanyDocForUser(session.userId, org.code, stage, document),
    getCompanyLetterheadForUser(session.userId, org.code),
  ]);
  if (!detail || !company) notFound();

  return (
    <CompanyDocEditor
      // A different paper starts with its own settings on screen.
      key={`${stage}/${document}`}
      orgCode={org.code}
      initialDetail={detail}
      company={company}
      today={appDateValue()}
    />
  );
}
