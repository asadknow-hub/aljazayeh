import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { withTenantContext, type DbTransaction } from "@/db/client";
import { bankAccounts } from "@/db/schema";
import { assertCan, can } from "@/lib/access/access";
import {
  BANK_DETAIL_FIELDS,
  type BankAccount,
  type BankAccountInput,
} from "@/lib/banks/types";
import { UserError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { requireOrg, resolveOrg, type ResolvedOrg } from "@/lib/org/resolve";

const MAX_LENGTH = 120;

/** The company's bank accounts in use, the default one first. */
export async function loadBankAccounts(
  tx: DbTransaction,
  organizationId: string,
): Promise<BankAccount[]> {
  const rows = await tx
    .select()
    .from(bankAccounts)
    .where(
      and(
        eq(bankAccounts.organizationId, organizationId),
        eq(bankAccounts.active, true),
      ),
    )
    .orderBy(desc(bankAccounts.isDefault), asc(bankAccounts.createdAt));

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    isDefault: row.isDefault,
    bankName: row.bankName,
    accountName: row.accountName,
    accountNumber: row.accountNumber,
    iban: row.iban,
    swift: row.swift,
    branch: row.branch,
  }));
}

/** The bank accounts, for the people in Accounts who keep them. */
export async function listBankAccountsForUser(
  userId: string,
  orgCode: string,
): Promise<BankAccount[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await resolveOrg(tx, userId, orgCode);
    if (!org || !can.manageBankAccounts(org.access)) return [];
    return loadBankAccounts(tx, org.id);
  });
}

function normalize(input: BankAccountInput): BankAccountInput {
  const clean = (value: string | undefined) =>
    String(value ?? "")
      .trim()
      .replace(/\s+/g, " ");
  const account = {
    label: clean(input.label),
    ...Object.fromEntries(
      BANK_DETAIL_FIELDS.map((field) => [field.key, clean(input[field.key])]),
    ),
  } as BankAccountInput;

  if (!account.bankName) throw new UserError("Enter the bank's name.");
  if (!account.accountNumber && !account.iban) {
    throw new UserError("Enter the account number or the IBAN.");
  }
  if (Object.values(account).some((value) => value.length > MAX_LENGTH)) {
    throw new UserError("One of the details is too long.");
  }
  // What it is called when choosing it; the bank's name if nothing is typed.
  account.label ||= account.bankName;
  return account;
}

async function requireKeeper(
  tx: DbTransaction,
  userId: string,
  orgCode: string,
): Promise<ResolvedOrg> {
  const org = await requireOrg(tx, userId, orgCode);
  assertCan(can.manageBankAccounts(org.access));
  return org;
}

async function requireAccount(
  tx: DbTransaction,
  org: ResolvedOrg,
  accountId: string,
) {
  const account = isUuid(accountId)
    ? (await loadBankAccounts(tx, org.id)).find((item) => item.id === accountId)
    : undefined;
  if (!account) throw new UserError("That bank account is no longer there.");
  return account;
}

/** Add a bank account. The company's first one is its default. */
export async function addBankAccountForUser(
  userId: string,
  orgCode: string,
  input: BankAccountInput,
): Promise<BankAccount[]> {
  const account = normalize(input);
  return withTenantContext(userId, async (tx) => {
    const org = await requireKeeper(tx, userId, orgCode);
    const existing = await loadBankAccounts(tx, org.id);
    if (
      existing.some(
        (item) => item.label.toLowerCase() === account.label.toLowerCase(),
      )
    ) {
      throw new UserError(
        `There is already an account called "${account.label}". Give this one another name.`,
      );
    }
    await tx.insert(bankAccounts).values({
      organizationId: org.id,
      ...account,
      isDefault: existing.length === 0,
    });
    return loadBankAccounts(tx, org.id);
  });
}

/**
 * Correct an account's details. Papers already issued keep the details they
 * were issued with; papers still being prepared take the corrected ones the
 * next time they are saved.
 */
export async function updateBankAccountForUser(
  userId: string,
  orgCode: string,
  accountId: string,
  input: BankAccountInput,
): Promise<BankAccount[]> {
  const account = normalize(input);
  return withTenantContext(userId, async (tx) => {
    const org = await requireKeeper(tx, userId, orgCode);
    const current = await requireAccount(tx, org, accountId);
    const others = (await loadBankAccounts(tx, org.id)).filter(
      (item) => item.id !== current.id,
    );
    if (
      others.some(
        (item) => item.label.toLowerCase() === account.label.toLowerCase(),
      )
    ) {
      throw new UserError(
        `There is already an account called "${account.label}". Give this one another name.`,
      );
    }
    await tx
      .update(bankAccounts)
      .set({ ...account, updatedAt: new Date() })
      .where(eq(bankAccounts.id, current.id));
    return loadBankAccounts(tx, org.id);
  });
}

/** Make an account the one new papers start with. */
export async function setDefaultBankAccountForUser(
  userId: string,
  orgCode: string,
  accountId: string,
): Promise<BankAccount[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireKeeper(tx, userId, orgCode);
    const account = await requireAccount(tx, org, accountId);
    await tx
      .update(bankAccounts)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(bankAccounts.organizationId, org.id));
    await tx
      .update(bankAccounts)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(bankAccounts.id, account.id));
    return loadBankAccounts(tx, org.id);
  });
}

/**
 * Stop using an account. It is no longer offered on new papers; papers that
 * already carry it are not touched. If it was the default, the oldest of the
 * others takes over.
 */
export async function removeBankAccountForUser(
  userId: string,
  orgCode: string,
  accountId: string,
): Promise<BankAccount[]> {
  return withTenantContext(userId, async (tx) => {
    const org = await requireKeeper(tx, userId, orgCode);
    const account = await requireAccount(tx, org, accountId);
    await tx
      .update(bankAccounts)
      .set({ active: false, isDefault: false, updatedAt: new Date() })
      .where(eq(bankAccounts.id, account.id));

    const left = await loadBankAccounts(tx, org.id);
    if (account.isDefault && left[0]) {
      await tx
        .update(bankAccounts)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(bankAccounts.id, left[0].id));
    }
    return loadBankAccounts(tx, org.id);
  });
}
