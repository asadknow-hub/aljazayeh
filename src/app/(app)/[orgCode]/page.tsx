import { CompanyHomeClient } from "@/app/(app)/[orgCode]/company-home-client";
import { canOpenTile } from "@/lib/access/access";
import { DEPARTMENTS } from "@/lib/departments/catalog";
import { formatLeavePeriod } from "@/lib/datetime/format";
import { FORM_DEFINITIONS, formatAmount } from "@/lib/forms/definitions";
import { listFormsAwaitingMySignature } from "@/lib/forms/queries";
import { listInquiryTasksForUser } from "@/lib/inquiries/queries";
import { inquiryStageLabel, stageNumber } from "@/lib/inquiries/stages";
import { loadOrgPage } from "@/lib/org/page";
import { listVacationsAwaitingMySignature } from "@/lib/vacation/queries";

export const instant = false;

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ orgCode: string }>;
}) {
  const { session, org } = await loadOrgPage((await params).orgCode);

  const [inquiries, leave, forms] = await Promise.all([
    listInquiryTasksForUser(session.userId, org.code),
    listVacationsAwaitingMySignature(session.userId, org.code),
    listFormsAwaitingMySignature(session.userId, org.code),
  ]);
  const tasks = [
    ...inquiries.map(({ inquiry, reason }) => ({
      href: `/${org.code}/${inquiry.owningDepartmentKey}/inquiries/${inquiry.id}`,
      title: `${inquiry.number} · ${inquiry.title || inquiry.customerName}`,
      detail: `Step ${stageNumber(inquiry.currentStage, inquiry.jobType)} · ${inquiryStageLabel(inquiry.currentStage)} · ${
        reason === "assigned" ? "assigned to you" : "waiting for your approval"
      }`,
      action: reason === "assigned" ? "Open" : "Open and approve",
    })),
    ...leave.map((item) => ({
      href: `/${org.code}/leave/${item.id}`,
      title: `Leave request · ${item.staffName}`,
      detail: formatLeavePeriod(item.startDate, item.endDate, item.dayCount),
      action: "Open and sign",
    })),
    ...forms.map((item) => ({
      href: `/${org.code}/forms/${item.id}`,
      title: `${FORM_DEFINITIONS[item.formType].title} · ${item.summary}`,
      detail: [
        item.referenceNo,
        item.amount ? `AED ${formatAmount(item.amount)}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      action: "Open and sign",
    })),
  ];

  return (
    <CompanyHomeClient
      org={org}
      tiles={DEPARTMENTS.filter((dept) => canOpenTile(org.access, dept.key))}
      tasks={tasks}
    />
  );
}
