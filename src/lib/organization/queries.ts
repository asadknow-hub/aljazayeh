import "server-only";

import { and, asc, count, eq, isNotNull } from "drizzle-orm";
import { withTenantContext, type DbTransaction } from "@/db/client";
import {
  inquiries,
  inquiryWorkflowSettings,
  organizationSettings,
  orgPositions,
  staffDepartmentAssignments,
  staffMembers,
} from "@/db/schema";
import { assertCan, can } from "@/lib/access/access";
import { UserError } from "@/lib/errors";
import { FORM_DEFINITIONS, isFormType } from "@/lib/forms/definitions";
import { settleApprovalForms } from "@/lib/forms/queries";
import { isUuid } from "@/lib/ids";
import { approverOptions, OWNERS_APPROVE } from "@/lib/inquiries/approvers";
import { loadWorkflow } from "@/lib/inquiries/queries";
import {
  INQUIRY_STAGES,
  INQUIRY_WORKFLOW_DEPARTMENTS,
} from "@/lib/inquiries/stages";
import { requireOrg, resolveOrg, type ResolvedOrg } from "@/lib/org/resolve";
import {
  ACCOUNTS_DEPARTMENT,
  CHART_DEPARTMENTS,
  isChartDepartment,
  MAX_OWNERS,
  MAX_TITLE_LENGTH,
} from "@/lib/organization/chart";
import { loadPositions } from "@/lib/organization/positions";
import type {
  ChartPosition,
  OrganizationChart,
  PositionInput,
} from "@/lib/organization/types";
import {
  documentsSignedBy,
  isSigningRole,
  OWNERS_BLOCK,
  SIGNING_ROLES,
  type DocumentType,
} from "@/lib/signoffs/chains";
import { settleVacationRequests } from "@/lib/vacation/queries";

/** What a change to the chart did besides the change itself. */
export type ChartChange = {
  chart: OrganizationChart;
  /** Forms that were only waiting for what was removed, and are now approved. */
  settled: number;
};

const documentName = (type: DocumentType): string =>
  isFormType(type) ? FORM_DEFINITIONS[type].title : "Leave Request";

/* --------------------------------- reading -------------------------------- */

async function loadChart(
  tx: DbTransaction,
  org: ResolvedOrg,
): Promise<OrganizationChart> {
  const positions = await loadPositions(tx, org.id);
  const { map, approvers } = await loadWorkflow(tx, org.id);
  const stepsApprovedBy = (key: string) =>
    INQUIRY_STAGES.filter((stage) => approvers[stage.key]?.key === key).map(
      (stage) => stage.label,
    );

  const staff = await tx
    .select({
      id: staffMembers.id,
      fullName: staffMembers.fullName,
      jobTitle: staffMembers.jobTitle,
      hasLogin: isNotNull(staffMembers.userId),
      departmentKey: staffDepartmentAssignments.departmentKey,
    })
    .from(staffMembers)
    .leftJoin(
      staffDepartmentAssignments,
      eq(staffDepartmentAssignments.staffId, staffMembers.id),
    )
    .where(
      and(
        eq(staffMembers.organizationId, org.id),
        eq(staffMembers.status, "active"),
      ),
    )
    .orderBy(asc(staffMembers.fullName));

  const toView = (position: (typeof positions)[number]): ChartPosition => ({
    ...position,
    signs: documentsSignedBy(position).map(documentName),
    approves: stepsApprovedBy(
      position.block === OWNERS_BLOCK ? OWNERS_APPROVE : position.id,
    ),
  });

  const candidates = new Map<string, OrganizationChart["candidates"][number]>();
  for (const row of staff) {
    if (!row.hasLogin) continue;
    const person = candidates.get(row.id) ?? {
      id: row.id,
      fullName: row.fullName,
      jobTitle: row.jobTitle,
      departmentKeys: [],
    };
    if (row.departmentKey) person.departmentKeys.push(row.departmentKey);
    candidates.set(row.id, person);
  }

  const closed = org.access.closedDepartments as string[];
  return {
    owners: positions
      .filter((position) => position.block === OWNERS_BLOCK)
      .map(toView),
    departments: CHART_DEPARTMENTS.filter(
      (department) => !closed.includes(department.key),
    ).map((department) => ({
      key: department.key,
      label: department.label,
      positions: positions
        .filter((position) => position.block === department.key)
        .map(toView),
      staff: staff
        .filter((row) => row.departmentKey === department.key)
        .map((row) => row.fullName),
      prepares: INQUIRY_STAGES.filter(
        (stage) => map[stage.key].departmentKey === department.key,
      ).map((stage) => stage.label),
    })),
    closedDepartments: CHART_DEPARTMENTS.filter((department) =>
      closed.includes(department.key),
    ).map(({ key, label }) => ({ key, label })),
    unfilledRoles: SIGNING_ROLES.filter(
      (role) => !positions.some((position) => position.signsAs === role.key),
    ).map((role) => ({
      key: role.key,
      title: role.title,
      signs: documentsSignedBy({ block: "", signsAs: role.key }).map(
        documentName,
      ),
    })),
    candidates: [...candidates.values()],
    canEdit: can.manageCompany(org.access),
  };
}

/** The organisation chart. Everyone in the company may look at it. */
export async function getOrganizationChartForUser(
  userId: string,
  orgCode: string,
): Promise<OrganizationChart | null> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    return org ? loadChart(tx, org) : null;
  });
}

/**
 * What the inquiry settings can choose from: the departments the company
 * has that can prepare a step, and who can approve one.
 */
export async function getWorkflowChoicesForUser(
  userId: string,
  orgCode: string,
): Promise<{
  departments: { key: string; label: string }[];
  approvers: { key: string; label: string }[];
} | null> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.manageCompany(org.access)) return null;
    return {
      departments: INQUIRY_WORKFLOW_DEPARTMENTS.filter(
        (department) => !org.access.closedDepartments.includes(department.key),
      ).map(({ key, label }) => ({ key, label })),
      approvers: approverOptions(await loadPositions(tx, org.id)),
    };
  });
}

/* --------------------------------- changes -------------------------------- */

async function requireEditor(
  tx: DbTransaction,
  userId: string,
  orgCode: string,
): Promise<ResolvedOrg> {
  const org = await requireOrg(tx, userId, orgCode);
  assertCan(can.manageCompany(org.access));
  return org;
}

function tidyTitle(
  raw: string,
  positions: { id: string; title: string }[],
  self?: string,
): string {
  const title = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!title) throw new UserError("Give the position a title.");
  if (title.length > MAX_TITLE_LENGTH) {
    throw new UserError("The title is too long.");
  }
  if (
    positions.some(
      (position) =>
        position.id !== self &&
        position.title.toLowerCase() === title.toLowerCase(),
    )
  ) {
    throw new UserError(`There is already a position called "${title}".`);
  }
  return title;
}

/**
 * The person named for a position: active, with a login to sign with. An
 * owner oversees the whole company, so they are put in Management too.
 */
async function resolveHolder(
  tx: DbTransaction,
  org: ResolvedOrg,
  staffId: string,
  block: string,
): Promise<string | null> {
  if (!staffId) return null;
  const [staff] = isUuid(staffId)
    ? await tx
        .select({ id: staffMembers.id, userId: staffMembers.userId })
        .from(staffMembers)
        .where(
          and(
            eq(staffMembers.id, staffId),
            eq(staffMembers.organizationId, org.id),
            eq(staffMembers.status, "active"),
          ),
        )
        .limit(1)
    : [];
  if (!staff?.userId) {
    throw new UserError(
      "Only an active staff member with a login can hold a position.",
    );
  }
  if (block === OWNERS_BLOCK) {
    await tx
      .insert(staffDepartmentAssignments)
      .values({ staffId: staff.id, departmentKey: "management" })
      .onConflictDoNothing();
  }
  return staff.id;
}

/**
 * After something was taken off the chart: forms that were only waiting for
 * it are approved.
 */
async function settle(
  tx: DbTransaction,
  org: ResolvedOrg,
  userId: string,
): Promise<number> {
  return (
    (await settleVacationRequests(tx, org, userId)) +
    (await settleApprovalForms(tx, org))
  );
}

/** Take positions off the chart, and with them everything that asked for them. */
async function deletePositions(
  tx: DbTransaction,
  org: ResolvedOrg,
  positionIds: string[],
) {
  for (const id of positionIds) {
    // An inquiry step it approved needs no approval any more.
    await tx
      .update(inquiryWorkflowSettings)
      .set({
        approvalRequired: false,
        approvalRequiredBy: "",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(inquiryWorkflowSettings.organizationId, org.id),
          eq(inquiryWorkflowSettings.approvalRequiredBy, id),
        ),
      );
    await tx
      .delete(orgPositions)
      .where(
        and(eq(orgPositions.id, id), eq(orgPositions.organizationId, org.id)),
      );
  }
}

/** Add an owner, or a position in a department. */
export async function addPositionForUser(
  userId: string,
  orgCode: string,
  input: PositionInput,
): Promise<ChartChange> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireEditor(tx, userId, orgCode);
    const positions = await loadPositions(tx, org.id);
    const block = String(input?.block ?? "");
    const inBlock = positions.filter((position) => position.block === block);

    let signsAs: string | null = null;
    if (block === OWNERS_BLOCK) {
      if (inBlock.length >= MAX_OWNERS) {
        throw new UserError(`A company can have up to ${MAX_OWNERS} owners.`);
      }
    } else {
      if (
        !isChartDepartment(block) ||
        (org.access.closedDepartments as string[]).includes(block)
      ) {
        throw new UserError("Choose a department the company has.");
      }
      if (input.signsAs) {
        if (!isSigningRole(input.signsAs)) {
          throw new UserError("Unknown position.");
        }
        if (positions.some((item) => item.signsAs === input.signsAs)) {
          throw new UserError("That position is already on the chart.");
        }
        signsAs = input.signsAs;
      }
    }

    const order = await tx
      .select({ sortOrder: orgPositions.sortOrder })
      .from(orgPositions)
      .where(eq(orgPositions.organizationId, org.id));
    await tx.insert(orgPositions).values({
      organizationId: org.id,
      block,
      title: tidyTitle(input.title, positions),
      signsAs,
      staffId: await resolveHolder(tx, org, input.staffId, block),
      sortOrder: Math.max(-1, ...order.map((row) => row.sortOrder)) + 1,
    });

    return { chart: await loadChart(tx, org), settled: 0 };
  });
}

/** Change what a position is called and who holds it. */
export async function updatePositionForUser(
  userId: string,
  orgCode: string,
  positionId: string,
  input: { title: string; staffId: string },
): Promise<ChartChange> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireEditor(tx, userId, orgCode);
    const positions = await loadPositions(tx, org.id);
    const position = positions.find((item) => item.id === positionId);
    if (!position) throw new UserError("That position is no longer there.");

    await tx
      .update(orgPositions)
      .set({
        title: tidyTitle(input.title, positions, position.id),
        staffId: await resolveHolder(tx, org, input.staffId, position.block),
        updatedAt: new Date(),
      })
      .where(eq(orgPositions.id, position.id));

    return { chart: await loadChart(tx, org), settled: 0 };
  });
}

/**
 * Take a position off the chart. The forms stop asking for its signature,
 * an inquiry step it approved needs no approval any more, and forms that
 * were only waiting for it are approved.
 */
export async function removePositionForUser(
  userId: string,
  orgCode: string,
  positionId: string,
): Promise<ChartChange> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireEditor(tx, userId, orgCode);
    const positions = await loadPositions(tx, org.id);
    const position = positions.find((item) => item.id === positionId);
    if (!position) throw new UserError("That position is no longer there.");
    if (
      position.block === OWNERS_BLOCK &&
      positions.filter((item) => item.block === OWNERS_BLOCK).length === 1
    ) {
      throw new UserError("A company has at least one owner.");
    }

    await deletePositions(tx, org, [position.id]);
    const settled = await settle(tx, org, userId);
    return { chart: await loadChart(tx, org), settled };
  });
}

/** Move an owner one place earlier or later in the order the owners sign. */
export async function moveOwnerForUser(
  userId: string,
  orgCode: string,
  positionId: string,
  direction: "earlier" | "later",
): Promise<ChartChange> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireEditor(tx, userId, orgCode);
    const owners = (await loadPositions(tx, org.id)).filter(
      (position) => position.block === OWNERS_BLOCK,
    );
    const from = owners.findIndex((owner) => owner.id === positionId);
    const to = direction === "earlier" ? from - 1 : from + 1;
    if (from === -1 || to < 0 || to >= owners.length) {
      throw new UserError("That owner cannot be moved that way.");
    }

    const ordered = [...owners];
    ordered.splice(to, 0, ...ordered.splice(from, 1));
    for (const [index, owner] of ordered.entries()) {
      await tx
        .update(orgPositions)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(orgPositions.id, owner.id));
    }

    return { chart: await loadChart(tx, org), settled: 0 };
  });
}

/**
 * Say the company does not have a department, or that it has it after all.
 * A department can only go once nobody is in it and no inquiry step is
 * prepared by it; its positions go with it.
 */
export async function setDepartmentInUseForUser(
  userId: string,
  orgCode: string,
  departmentKey: string,
  inUse: boolean,
): Promise<ChartChange> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireEditor(tx, userId, orgCode);
    const department = CHART_DEPARTMENTS.find(
      (item) => item.key === departmentKey,
    );
    if (!department) throw new UserError("Unknown department.");
    const closed = new Set<string>(org.access.closedDepartments);

    if (inUse) {
      closed.delete(department.key);
    } else {
      if (department.key === ACCOUNTS_DEPARTMENT) {
        throw new UserError("Every company has Accounts.");
      }
      const [people] = await tx
        .select({ total: count() })
        .from(staffDepartmentAssignments)
        .innerJoin(
          staffMembers,
          eq(staffMembers.id, staffDepartmentAssignments.staffId),
        )
        .where(
          and(
            eq(staffMembers.organizationId, org.id),
            eq(staffMembers.status, "active"),
            eq(staffDepartmentAssignments.departmentKey, department.key),
          ),
        );
      if (people && people.total > 0) {
        throw new UserError(
          `${people.total === 1 ? "1 person is" : `${people.total} people are`} still in ${department.label}. Move them to another department under Staff first.`,
        );
      }
      const { map } = await loadWorkflow(tx, org.id);
      const prepares = INQUIRY_STAGES.filter(
        (stage) => map[stage.key].departmentKey === department.key,
      );
      if (prepares.length > 0) {
        throw new UserError(
          `${department.label} still prepares ${prepares.map((stage) => stage.label).join(", ")}. Give ${prepares.length === 1 ? "that step" : "those steps"} to another department under Company Settings first.`,
        );
      }
      const [open] = await tx
        .select({ total: count() })
        .from(inquiries)
        .where(
          and(
            eq(inquiries.organizationId, org.id),
            eq(inquiries.status, "open"),
            eq(inquiries.owningDepartmentKey, department.key),
          ),
        );
      if (open && open.total > 0) {
        throw new UserError(
          `${department.label} still has open inquiries. Finish or close them first.`,
        );
      }

      const positions = await loadPositions(tx, org.id);
      await deletePositions(
        tx,
        org,
        positions
          .filter((position) => position.block === department.key)
          .map((position) => position.id),
      );
      closed.add(department.key);
    }

    const closedDepartments = [...closed];
    await tx
      .insert(organizationSettings)
      .values({ organizationId: org.id, closedDepartments })
      .onConflictDoUpdate({
        target: organizationSettings.organizationId,
        set: { closedDepartments, updatedAt: new Date() },
      });

    // The company as it is now, for the chart that goes back.
    const updated = await requireOrg(tx, userId, orgCode);
    const settled = inUse ? 0 : await settle(tx, updated, userId);
    return { chart: await loadChart(tx, updated), settled };
  });
}
