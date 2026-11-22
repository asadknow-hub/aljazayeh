import type { ReactNode } from "react";
import { DepartmentChip } from "@/components/inquiries/inquiry-chips";
import type { CompanyDocStep } from "@/lib/company-docs/types";
import { INQUIRY_APPROVAL_ROLES } from "@/lib/inquiries/stages";

/** "8 jobs", "1 job". */
export function countLabel(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

export function approverLabel(key: string): string {
  return INQUIRY_APPROVAL_ROLES.find((role) => role.key === key)?.label ?? key;
}

/** Where a step sits in the process, for local and for export jobs. */
export function stepPlace(step: Pick<CompanyDocStep, "number">): {
  number: number;
  note: string;
} {
  const { local, export: abroad } = step.number;
  if (local === null) return { number: abroad!, note: "Export jobs only" };
  return {
    number: local,
    note:
      abroad !== null && abroad !== local
        ? `Step ${abroad} on an export job`
        : "",
  };
}

/** When a paper is prepared: for every job, or only for some. */
export function whenPrepared(
  onlyWhen: { question: string; answer: string } | null,
): string {
  if (!onlyWhen) return "Every job";
  return onlyWhen.answer === "Yes"
    ? `Only when “${onlyWhen.question}” is ticked`
    : `Only when “${onlyWhen.question}” is “${onlyWhen.answer}”`;
}

/** One fact about a document: what it is on the left, the answer beside it. */
export function Fact({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 py-2">
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </dt>
      <dd className="min-w-0 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

/** The step a paper belongs to: who prepares it and who approves it. */
export function StepFacts({ step }: { step: Omit<CompanyDocStep, "docs"> }) {
  const place = stepPlace(step);
  return (
    <>
      <Fact label="Used in">
        <span className="font-medium">
          Step {place.number} · {step.label}
        </span>
        {place.note ? (
          <span className="block text-slate-600">{place.note}</span>
        ) : null}
      </Fact>
      <Fact label="Prepared by">
        <DepartmentChip department={step.departmentKey} />
      </Fact>
      <Fact label="Approval">
        {step.approvalBy
          ? `${approverLabel(step.approvalBy)} approves it before the job moves on`
          : "Not needed"}
      </Fact>
    </>
  );
}
