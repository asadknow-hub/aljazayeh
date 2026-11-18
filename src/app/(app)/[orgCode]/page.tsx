import { CompanyHomeClient } from "@/app/(app)/[orgCode]/company-home-client";
import { canOpenTile } from "@/lib/access/access";
import { DEPARTMENTS } from "@/lib/departments/catalog";
import { formatLeavePeriod } from "@/lib/datetime/format";
import { FORM_DEFINITIONS, formatAmount } from "@/lib/forms/definitions";
import { listFormsAwaitingMySignature } from "@/lib/forms/queries";
import { loadOrgPage } from "@/lib/org/page";
import { listVacationsAwaitingMySignature } from "@/lib/vacation/queries";

export const instant = false;

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ orgCode: string }>;
}) {
  const { session, org } = await loadOrgPage((await params).orgCode);

  const [leave, forms] = await Promise.all([
    listVacationsAwaitingMySignature(session.userId, org.code),
    listFormsAwaitingMySignature(session.userId, org.code),
  ]);
  const tasks = [
    ...leave.map((item) => ({
      href: `/${org.code}/leave/${item.id}`,
      title: `Leave request · ${item.staffName}`,
      detail: formatLeavePeriod(item.startDate, item.endDate, item.dayCount),
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
