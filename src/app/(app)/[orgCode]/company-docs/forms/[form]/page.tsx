import { notFound } from "next/navigation";
import { SignedFormDoc } from "@/components/company-docs/signed-form-doc";
import { can } from "@/lib/access/access";
import { isSignedFormKey } from "@/lib/company-docs/catalog";
import { getSignedFormDocForUser } from "@/lib/company-docs/queries";
import { getCompanyLetterheadForUser } from "@/lib/company-settings/queries";
import { appDateValue } from "@/lib/datetime/format";
import { loadOrgPage } from "@/lib/org/page";

export const instant = false;

/** One signed form: where it is raised, who signs it, and a sample of it. */
export default async function SignedFormDocPage({
  params,
}: {
  params: Promise<{ orgCode: string; form: string }>;
}) {
  const { orgCode, form } = await params;
  if (!isSignedFormKey(form)) notFound();
  const { session, org } = await loadOrgPage(orgCode);

  const [row, company] = await Promise.all([
    getSignedFormDocForUser(session.userId, org.code, form),
    getCompanyLetterheadForUser(session.userId, org.code),
  ]);
  if (!row || !company) notFound();

  return (
    <SignedFormDoc
      orgCode={org.code}
      form={row}
      company={company}
      today={appDateValue()}
      canSetSignatories={can.manageCompany(org.access)}
    />
  );
}
