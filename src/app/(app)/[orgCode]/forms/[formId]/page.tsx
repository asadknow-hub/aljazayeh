import { notFound } from "next/navigation";
import { DocumentSplit } from "@/components/documents/document-split";
import { ApprovalFormSheet } from "@/components/forms/approval-form-sheet";
import { ApprovalPanel } from "@/components/signoffs/approval-panel";
import { signApprovalFormAction } from "@/lib/forms/actions";
import { FORM_DEFINITIONS, formListPath } from "@/lib/forms/definitions";
import { printedForm } from "@/lib/forms/print";
import { canRaise, getApprovalFormDocumentForUser } from "@/lib/forms/queries";
import { loadOrgPage } from "@/lib/org/page";

export const instant = false;

/** One of the signed forms: where its approval stands, beside the form. */
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
    <DocumentSplit
      // Someone who only signs it came from their tasks on the home screen.
      backHref={
        canRaise(org.access, form.formType)
          ? formListPath(org.code, form.formType)
          : `/${org.code}`
      }
      landscape={printedForm(form).orientation === "landscape"}
      printLabel="Print"
      side={
        <ApprovalPanel
          title={FORM_DEFINITIONS[form.formType].title}
          reference={form.referenceNo}
          signoffs={form.signoffs}
          onSign={signApprovalFormAction.bind(null, org.code, form.id)}
        />
      }
    >
      <ApprovalFormSheet form={form} />
    </DocumentSplit>
  );
}
