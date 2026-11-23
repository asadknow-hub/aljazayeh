/**
 * Who approves an inquiry step. The workflow settings name either the
 * owners, any one of whom may approve, or one position of the organisation
 * chart; the people come from the chart.
 */
import type { InquiryWorkflowStageConfig } from "@/lib/inquiries/stages";
import { OWNERS_BLOCK, type SigningPosition } from "@/lib/signoffs/chains";

/** How the owners are named as a step's approver. */
export const OWNERS_APPROVE = OWNERS_BLOCK;

export type StepApprover = {
  /** `OWNERS_APPROVE`, or the id of the position. */
  key: string;
  /** "Owners", or the position's title. */
  label: string;
  /** The staff who may give the approval today. */
  staffIds: string[];
};

/**
 * A step's approver, or nothing if it needs no approval. A step set to be
 * approved by a position that is no longer on the chart needs none.
 */
export function stepApprover(
  config: InquiryWorkflowStageConfig,
  positions: readonly SigningPosition[],
): StepApprover | null {
  if (!config.approvalRequired) return null;

  const holders = (list: readonly SigningPosition[]) =>
    list.flatMap((position) => (position.staffId ? [position.staffId] : []));

  if (config.approvalRequiredBy === OWNERS_APPROVE) {
    const owners = positions.filter(
      (position) => position.block === OWNERS_BLOCK,
    );
    return { key: OWNERS_APPROVE, label: "Owners", staffIds: holders(owners) };
  }
  const position = positions.find(
    (item) => item.id === config.approvalRequiredBy,
  );
  return position
    ? { key: position.id, label: position.title, staffIds: holders([position]) }
    : null;
}

/** Everyone a step can be set to be approved by. */
export function approverOptions(
  positions: readonly SigningPosition[],
): { key: string; label: string }[] {
  return [
    { key: OWNERS_APPROVE, label: "Owners (any one of them)" },
    ...positions
      .filter((position) => position.block !== OWNERS_BLOCK)
      .map((position) => ({
        key: position.id,
        label: `${position.title} (${position.staffName || "nobody yet"})`,
      })),
  ];
}
