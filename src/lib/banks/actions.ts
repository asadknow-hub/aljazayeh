"use server";

import { runAction } from "@/lib/actions/result";
import { revalidateCompanyPages } from "@/lib/actions/revalidate";
import { requireSession } from "@/lib/auth/session";
import {
  addBankAccountForUser,
  removeBankAccountForUser,
  setDefaultBankAccountForUser,
  updateBankAccountForUser,
} from "@/lib/banks/queries";
import type { BankAccount, BankAccountInput } from "@/lib/banks/types";

/** Run a change to the bank accounts; open papers pick it up. */
function change(work: (userId: string) => Promise<BankAccount[]>) {
  return runAction(async () => {
    const session = await requireSession();
    const accounts = await work(session.userId);
    revalidateCompanyPages();
    return accounts;
  });
}

export async function addBankAccountAction(
  orgCode: string,
  input: BankAccountInput,
) {
  return change((userId) => addBankAccountForUser(userId, orgCode, input));
}

export async function updateBankAccountAction(
  orgCode: string,
  accountId: string,
  input: BankAccountInput,
) {
  return change((userId) =>
    updateBankAccountForUser(userId, orgCode, accountId, input),
  );
}

export async function setDefaultBankAccountAction(
  orgCode: string,
  accountId: string,
) {
  return change((userId) =>
    setDefaultBankAccountForUser(userId, orgCode, accountId),
  );
}

export async function removeBankAccountAction(
  orgCode: string,
  accountId: string,
) {
  return change((userId) =>
    removeBankAccountForUser(userId, orgCode, accountId),
  );
}
