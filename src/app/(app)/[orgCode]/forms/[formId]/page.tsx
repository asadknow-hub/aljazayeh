import { notFound } from "next/navigation";
import { DocumentActions } from "@/components/documents/document-actions";
import { ApprovalFormSheet } from "@/components/forms/approval-form-sheet";
import { signApprovalFormAction } from "@/lib/forms/actions";
import { FORM_DEFINITIONS } from "@/lib/forms/definitions";
import { printedForm } from "@/lib/forms/print";
import { getApprovalFormDocumentForUser } from "@/lib/forms/queries";
import { loadOrgPage } from "@/lib/org/page";

export const instant = false;

/** One of the signed forms: on screen exactly as it prints. */
export default async function ApprovalFormPage({
  params,
}: {
  params: Promise<{ orgCode: string; formId: string }>;
}) {
  const { orgCode, formId } = await params;
  const { session, org } = await loadOrgPage(orgCode);

  // Returns nothing for people who have no business with this form.
  const form = await getApprovalFormDocumentForUser(
    session.userId,
    org.code,
    formId,
  );
  if (!form) notFound();

  return (
    <main className="flex-1 p-4 sm:p-6 print:p-0">
      <DocumentActions
        title={FORM_DEFINITIONS[form.formType].title}
        backHref={`/${org.code}`}
        landscape={printedForm(form).orientation === "landscape"}
        signoffs={form.signoffs}
        onSign={signApprovalFormAction.bind(null, org.code, form.id)}
      />
      <ApprovalFormSheet form={form} />
    </main>
  );
}
