import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { withTenantContext, type DbTransaction } from "@/db/client";
import { approvalForms, organizationSettings, staffMembers } from "@/db/schema";
import { assertCan, can, type OrgAccess } from "@/lib/access/access";
import { nextDocumentNumber } from "@/lib/documents/numbering";
import { UserError } from "@/lib/errors";
import {
  FORM_DEFINITIONS,
  isFormType,
  type ApprovalFormInput,
  type ApprovalFormView,
  type FormAnswers,
  type FormType,
} from "@/lib/forms/definitions";
import { OVERTIME_PAY_KEYS, overtimePay } from "@/lib/forms/overtime";
import { isUuid } from "@/lib/ids";
import { normalizeFormAnswers } from "@/lib/forms/validate";
import { requireOrg, resolveOrg, type ResolvedOrg } from "@/lib/org/resolve";
import type { SignoffDecision, SignoffState } from "@/lib/signoffs/chains";
import { verifyApprovalPin } from "@/lib/signoffs/credentials";
import {
  assertChainStaffed,
  isSignerOf,
  loadSignoffState,
  signAsPreparer,
  signNextStep,
} from "@/lib/signoffs/queries";

type FormRow = typeof approvalForms.$inferSelect;

/** A form is raised by Reception or by the department it belongs to. */
/** The person works where this kind of form is raised and listed. */
export function canRaise(access: OrgAccess, type: FormType): boolean {
  const place = FORM_DEFINITIONS[type].raisedIn;
  return place === "reception"
    ? can.useReception(access)
    : can.openDepartment(access, place);
}

/**
 * Whether a form's money is shown to the person. Only the overtime sheet
 * holds money that is not everyone's to see: what people are paid for
 * overtime gives away their salary.
 */
function showsMoney(access: OrgAccess, type: FormType): boolean {
  return type !== "overtime" || can.seeOvertimePay(access);
}

/** A form's lines as the person may see them. */
function linesFor(
  access: OrgAccess,
  type: FormType,
  lines: Record<string, string>[],
): Record<string, string>[] {
  if (showsMoney(access, type)) return lines;
  return lines.map((line) =>
    Object.fromEntries(
      Object.entries(line).filter(([key]) => !OVERTIME_PAY_KEYS.includes(key)),
    ),
  );
}

function toView(
  access: OrgAccess,
  row: FormRow,
  staffName: string | null,
): ApprovalFormView {
  const type = row.formType as FormType;
  const { fields, lines } = row;
  return {
    id: row.id,
    formType: type,
    referenceNo: row.referenceNo,
    staffName: staffName ?? "",
    summary:
      FORM_DEFINITIONS[type].summary?.({ fields, lines }) ??
      staffName ??
      fields.projectName ??
      lines[0]?.description ??
      FORM_DEFINITIONS[type].title,
    amount: showsMoney(access, type) ? row.amount : null,
    status: row.status as ApprovalFormView["status"],
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadForms(
  tx: DbTransaction,
  org: ResolvedOrg,
  filter: { type?: FormType; status?: string } = {},
): Promise<ApprovalFormView[]> {
  const rows = await tx
    .select({ form: approvalForms, staffName: staffMembers.fullName })
    .from(approvalForms)
    .leftJoin(staffMembers, eq(staffMembers.id, approvalForms.staffId))
    .where(
      and(
        eq(approvalForms.organizationId, org.id),
        filter.type ? eq(approvalForms.formType, filter.type) : undefined,
        filter.status ? eq(approvalForms.status, filter.status) : undefined,
      ),
    )
    .orderBy(desc(approvalForms.createdAt));

  return rows
    .filter((row) => isFormType(row.form.formType))
    .map((row) => toView(org.access, row.form, row.staffName));
}

/** The forms of one kind, for the place they are raised from. */
export async function listApprovalFormsForUser(
  userId: string,
  orgCode: string,
  type: FormType,
): Promise<ApprovalFormView[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !canRaise(org.access, type)) return [];
    return loadForms(tx, org, { type });
  });
}

/** Forms whose next signature is the signed-in person's. */
export async function listFormsAwaitingMySignature(
  userId: string,
  orgCode: string,
): Promise<ApprovalFormView[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org) return [];

    const mine: ApprovalFormView[] = [];
    for (const form of await loadForms(tx, org, { status: "pending" })) {
      const state = await loadSignoffState(tx, org, form.formType, form.id, {
        finished: false,
      });
      if (state.canSign) mine.push(form);
    }
    return mine;
  });
}

export async function createApprovalFormForUser(
  userId: string,
  orgCode: string,
  type: FormType,
  input: ApprovalFormInput,
): Promise<ApprovalFormView> {
  if (!isFormType(type)) throw new UserError("Unknown form.");
  const definition = FORM_DEFINITIONS[type];
  const answers = normalizeFormAnswers(type, input);

  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    assertCan(canRaise(org.access, type));
    await assertChainStaffed(tx, org, type);

    let staff: { id: string; fullName: string } | null = null;
    if (definition.aboutEmployee && isUuid(input.staffId)) {
      [staff = null] = await tx
        .select({ id: staffMembers.id, fullName: staffMembers.fullName })
        .from(staffMembers)
        .where(
          and(
            eq(staffMembers.id, input.staffId),
            eq(staffMembers.organizationId, org.id),
          ),
        )
        .limit(1);
    }
    if (definition.aboutEmployee && !staff) {
      throw new UserError("Select an employee.");
    }

    if (type === "overtime") {
      answers.lines = await overtimeLines(tx, org, answers.lines);
    }

    const amount = definition.amount(answers);
    const [created] = await tx
      .insert(approvalForms)
      .values({
        organizationId: org.id,
        formType: type,
        referenceNo: await nextDocumentNumber(tx, org, definition.counterKey),
        staffId: staff?.id ?? null,
        fields: answers.fields,
        lines: answers.lines,
        amount: amount === null ? null : amount.toFixed(2),
        createdByUserId: userId,
      })
      .returning();
    await signAsPreparer(tx, org, userId, type, created!.id);

    return toView(org.access, created!, staff?.fullName ?? null);
  });
}

/**
 * The lines of an overtime sheet as they are kept: each with the person's
 * name and employee ID, and what the overtime comes to at the salary on
 * record today. The figures stay as they are once the sheet is filed.
 */
async function overtimeLines(
  tx: DbTransaction,
  org: ResolvedOrg,
  lines: Record<string, string>[],
): Promise<Record<string, string>[]> {
  const ids = lines.map((line) => line.staffId!);
  if (new Set(ids).size !== ids.length) {
    throw new UserError(
      "Someone is on the sheet twice. Put all of a person's overtime for the day on one line.",
    );
  }
  const people = await tx
    .select({
      id: staffMembers.id,
      fullName: staffMembers.fullName,
      employeeCode: staffMembers.employeeCode,
      salaryAmount: staffMembers.salaryAmount,
    })
    .from(staffMembers)
    .where(
      and(
        eq(staffMembers.organizationId, org.id),
        inArray(staffMembers.id, ids),
      ),
    );

  return lines.map((line, index) => {
    const person = people.find((item) => item.id === line.staffId);
    if (!person) throw new UserError(`Line ${index + 1}: select an employee.`);
    const hours = Number(line.hours);
    if (!(hours > 0) || hours > 24) {
      throw new UserError(
        `Line ${index + 1}: enter how many hours of overtime ${person.fullName} worked.`,
      );
    }
    const pay = overtimePay(Number(person.salaryAmount) || 0, hours);
    return {
      ...line,
      name: person.fullName,
      employeeId: person.employeeCode,
      salary: pay.salary.toFixed(2),
      perDay: pay.perDay.toFixed(2),
      perHour: pay.perHour.toFixed(2),
      amount: pay.amount.toFixed(2),
    };
  });
}

/** Everything a form prints. */
export type ApprovalFormDocument = ApprovalFormView &
  FormAnswers & {
    company: { name: string; nameArabic: string; logoImage: string | null };
    employee: { fullName: string; jobTitle: string } | null;
    /** Who raised it. */
    raisedBy: { fullName: string; jobTitle: string };
    signoffs: SignoffState;
  };

async function findForm(tx: DbTransaction, org: ResolvedOrg, formId: string) {
  if (!isUuid(formId)) return null;
  const [row] = await tx
    .select()
    .from(approvalForms)
    .where(
      and(
        eq(approvalForms.id, formId),
        eq(approvalForms.organizationId, org.id),
      ),
    )
    .limit(1);
  return row && isFormType(row.formType)
    ? { ...row, formType: row.formType }
    : null;
}

/**
 * A form with its signatures. Open to whoever can raise that kind of form,
 * to its signatories, and to the employee it is about.
 */
export async function getApprovalFormDocumentForUser(
  userId: string,
  orgCode: string,
  formId: string,
): Promise<ApprovalFormDocument | null> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org) return null;
    const form = await findForm(tx, org, formId);
    if (!form) return null;

    const mayView =
      canRaise(org.access, form.formType) ||
      form.staffId === org.access.staffId ||
      (await isSignerOf(tx, org, userId, form.formType, form.id));
    if (!mayView) return null;

    const [employee = null] = form.staffId
      ? await tx
          .select({
            fullName: staffMembers.fullName,
            jobTitle: staffMembers.jobTitle,
          })
          .from(staffMembers)
          .where(eq(staffMembers.id, form.staffId))
          .limit(1)
      : [];

    const [raiser] = await tx
      .select({
        fullName: staffMembers.fullName,
        jobTitle: staffMembers.jobTitle,
      })
      .from(staffMembers)
      .where(
        and(
          eq(staffMembers.organizationId, org.id),
          eq(staffMembers.userId, form.createdByUserId),
        ),
      )
      .limit(1);
    const [raiserName] = await tx.execute<{ name: string | null }>(
      sql`select app_member_display_name(${form.createdByUserId}::uuid) as name`,
    );

    const [settings] = await tx
      .select({
        nameArabic: organizationSettings.nameArabic,
        logoImage: organizationSettings.logoImage,
      })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, org.id))
      .limit(1);

    return {
      ...toView(org.access, form, employee?.fullName ?? null),
      fields: form.fields,
      lines: linesFor(org.access, form.formType, form.lines),
      company: {
        name: org.name,
        nameArabic: settings?.nameArabic ?? "",
        logoImage: settings?.logoImage ?? null,
      },
      employee,
      raisedBy: {
        fullName: raiser?.fullName ?? raiserName?.name ?? "",
        jobTitle: raiser?.jobTitle ?? "",
      },
      signoffs: await loadSignoffState(tx, org, form.formType, form.id, {
        finished: form.status !== "pending",
      }),
    };
  });
}

/**
 * What is needed to show a new form as it will print while it is being
 * filled in: the letterhead, who raises it, who will sign, and the employees
 * it can be about.
 */
export type FormDraftContext = Pick<
  ApprovalFormDocument,
  "company" | "raisedBy" | "signoffs"
> & {
  employees: {
    id: string;
    fullName: string;
    jobTitle: string;
    employeeCode: string;
  }[];
};

export async function getFormDraftContextForUser(
  userId: string,
  orgCode: string,
  formType: FormType,
): Promise<FormDraftContext | null> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !canRaise(org.access, formType)) return null;

    const [raiser] = await tx
      .select({
        fullName: staffMembers.fullName,
        jobTitle: staffMembers.jobTitle,
      })
      .from(staffMembers)
      .where(eq(staffMembers.id, org.access.staffId))
      .limit(1);
    const definition = FORM_DEFINITIONS[formType];
    const employees =
      definition.aboutEmployee ||
      definition.lineColumns.some((column) => column.type === "employee")
      ? await tx
          .select({
            id: staffMembers.id,
            fullName: staffMembers.fullName,
            jobTitle: staffMembers.jobTitle,
            employeeCode: staffMembers.employeeCode,
          })
          .from(staffMembers)
          .where(
            and(
              eq(staffMembers.organizationId, org.id),
              eq(staffMembers.status, "active"),
            ),
          )
          .orderBy(staffMembers.fullName)
      : [];
    const [settings] = await tx
      .select({
        nameArabic: organizationSettings.nameArabic,
        logoImage: organizationSettings.logoImage,
      })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, org.id))
      .limit(1);

    return {
      company: {
        name: org.name,
        nameArabic: settings?.nameArabic ?? "",
        logoImage: settings?.logoImage ?? null,
      },
      raisedBy: {
        fullName: raiser?.fullName ?? "",
        jobTitle: raiser?.jobTitle ?? "",
      },
      // Nobody has signed a form that does not exist yet.
      signoffs: await loadSignoffState(
        tx,
        org,
        formType,
        crypto.randomUUID(),
        { finished: false },
      ),
      employees,
    };
  });
}

/** Approve or reject as the next signer, confirming with the approval PIN. */
export async function signApprovalFormForUser(
  userId: string,
  orgCode: string,
  formId: string,
  input: { pin: string; decision: SignoffDecision; remarks: string },
): Promise<ApprovalFormView["status"]> {
  await verifyApprovalPin(userId, input.pin);

  return withTenantContext(userId, async (tx) => {
    const org = await requireOrg(tx, userId, orgCode);
    const form = await findForm(tx, org, formId);
    if (!form) throw new UserError("Form not found.");

    const state = await signNextStep(
      tx,
      org,
      userId,
      form.formType,
      form.id,
      input,
    );
    if (state.status !== "pending") {
      await tx
        .update(approvalForms)
        .set({ status: state.status, updatedAt: new Date() })
        .where(eq(approvalForms.id, form.id));
    }
    return state.status;
  });
}

/**
 * After the organisation chart changed: forms that were only waiting for a
 * position that is no longer on it are approved. Returns how many.
 */
export async function settleApprovalForms(
  tx: DbTransaction,
  org: ResolvedOrg,
): Promise<number> {
  const pending = await tx
    .select({ id: approvalForms.id, formType: approvalForms.formType })
    .from(approvalForms)
    .where(
      and(
        eq(approvalForms.organizationId, org.id),
        eq(approvalForms.status, "pending"),
      ),
    );

  let settled = 0;
  for (const form of pending) {
    if (!isFormType(form.formType)) continue;
    const state = await loadSignoffState(tx, org, form.formType, form.id, {
      finished: false,
    });
    if (state.status === "approved") {
      await tx
        .update(approvalForms)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(approvalForms.id, form.id));
      settled += 1;
    }
  }
  return settled;
}
