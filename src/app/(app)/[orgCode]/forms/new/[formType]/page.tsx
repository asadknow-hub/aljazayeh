import { notFound } from "next/navigation";
import { FormEditor } from "@/components/forms/form-editor";
import { formListPath, isFormType } from "@/lib/forms/definitions";
import { getFormDraftContextForUser } from "@/lib/forms/queries";
import { loadOrgPage } from "@/lib/org/page";

export const instant = false;

/** Raise one of the signed forms: its details beside the form they fill in. */
export default async function NewApprovalFormPage({
  params,
}: {
  params: Promise<{ orgCode: string; formType: string }>;
}) {
  const { orgCode, formType } = await params;
  if (!isFormType(formType)) notFound();
  const { session, org } = await loadOrgPage(orgCode);

  // Returns nothing for people who may not raise this kind of form.
  const context = await getFormDraftContextForUser(
    session.userId,
    org.code,
    formType,
  );
  if (!context) notFound();

  return (
    <FormEditor
      orgCode={org.code}
      formType={formType}
      context={context}
      now={new Date().toISOString()}
      listHref={formListPath(org.code, formType)}
    />
  );
}
