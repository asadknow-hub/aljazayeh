"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { unwrap, type ActionResult } from "@/lib/actions/result";
import {
  addBankAccountAction,
  removeBankAccountAction,
  setDefaultBankAccountAction,
  updateBankAccountAction,
} from "@/lib/banks/actions";
import {
  BANK_DETAIL_FIELDS,
  type BankAccount,
  type BankAccountInput,
} from "@/lib/banks/types";

const NEW = "new";

const EMPTY: BankAccountInput = {
  label: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  iban: "",
  swift: "",
  branch: "",
};

/**
 * The company's bank accounts. Quotations and invoices offer these to choose
 * from, and print the chosen one's details.
 */
export function BankAccountsPanel({
  orgCode,
  initialAccounts,
}: {
  orgCode: string;
  initialAccounts: BankAccount[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState(initialAccounts);
  /** The account being changed, or NEW while one is being added. */
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<BankAccount | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function show(next: string | null) {
    setError(null);
    setEditing(next);
  }

  async function run(
    work: () => Promise<ActionResult<BankAccount[]>>,
    done: string,
  ) {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      setAccounts(await unwrap(work()));
      setEditing(null);
      setRemoving(null);
      showToast(done);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save.";
      // Outside the form there is nowhere to write it but the toast.
      if (editing) setError(message);
      else showToast(message);
      setRemoving(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Bank accounts
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            The accounts customers pay into. Whoever prepares a quotation or an
            invoice chooses one of these, and its details are printed on the
            paper.
          </p>
        </div>
        {editing !== NEW ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending}
            onClick={() => show(NEW)}
          >
            Add bank account
          </button>
        ) : null}
      </div>

      {editing === NEW ? (
        <BankAccountForm
          heading="New bank account"
          initial={EMPTY}
          pending={pending}
          error={error}
          onCancel={() => show(null)}
          onSubmit={(input) =>
            run(
              () => addBankAccountAction(orgCode, input),
              "Bank account added",
            )
          }
        />
      ) : null}

      {accounts.length === 0 && editing !== NEW ? (
        <div className="card px-4 py-8 text-center text-sm text-slate-600">
          No bank account yet. Add the first one and it will be printed on
          quotations and invoices.
        </div>
      ) : null}

      {accounts.map((account) =>
        editing === account.id ? (
          <BankAccountForm
            key={account.id}
            heading={`Change ${account.label}`}
            initial={account}
            pending={pending}
            error={error}
            onCancel={() => show(null)}
            onSubmit={(input) =>
              run(
                () => updateBankAccountAction(orgCode, account.id, input),
                "Bank account saved",
              )
            }
          />
        ) : (
          <article key={account.id} className="card px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                  <span className="break-words">{account.label}</span>
                  {account.isDefault ? (
                    <span className="chip bg-emerald-50 text-emerald-700">
                      Used first
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!account.isDefault ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => setDefaultBankAccountAction(orgCode, account.id),
                        `${account.label} is now used first`,
                      )
                    }
                  >
                    Use first
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={pending}
                  onClick={() => show(account.id)}
                >
                  Change
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={pending}
                  onClick={() => setRemoving(account)}
                >
                  Remove
                </button>
              </div>
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {BANK_DETAIL_FIELDS.filter((field) => account[field.key]).map(
                (field) => (
                  <div key={field.key} className="min-w-0">
                    <dt className="text-xs text-slate-500">{field.label}</dt>
                    <dd className="break-words text-slate-900">
                      {account[field.key]}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          </article>
        ),
      )}

      <ConfirmDeleteDialog
        open={removing !== null}
        title="Remove this bank account?"
        message={
          removing
            ? `${removing.label} will no longer be offered on new papers. Papers already issued with it keep it.`
            : ""
        }
        pending={pending}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing) return;
          const { id, label } = removing;
          void run(
            () => removeBankAccountAction(orgCode, id),
            `${label} removed`,
          );
        }}
      />
    </section>
  );
}

function BankAccountForm({
  heading,
  initial,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  heading: string;
  initial: BankAccountInput;
  pending: boolean;
  error: string | null;
  onSubmit: (input: BankAccountInput) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<BankAccountInput>({
    label: initial.label,
    bankName: initial.bankName,
    accountName: initial.accountName,
    accountNumber: initial.accountNumber,
    iban: initial.iban,
    swift: initial.swift,
    branch: initial.branch,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  const input = (key: keyof BankAccountInput, label: string, hint?: string) => (
    <label key={key} className="flex min-w-0 flex-col gap-1.5">
      <span className="field-label">{label}</span>
      <input
        className="field"
        value={values[key]}
        disabled={pending}
        maxLength={120}
        placeholder={hint}
        onChange={(event) =>
          setValues((current) => ({ ...current, [key]: event.target.value }))
        }
      />
    </label>
  );

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4 px-4 py-4">
      <p className="font-semibold text-slate-900">{heading}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {BANK_DETAIL_FIELDS.map((field) => input(field.key, field.label))}
        {input(
          "label",
          "Name to choose it by",
          values.bankName || "Wio Bank, main account",
        )}
      </div>
      <p className="text-xs text-slate-500">
        The name to choose it by is what people see in the list on a paper. Left
        empty, the bank&apos;s name is used.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save bank account"}
        </button>
      </div>
    </form>
  );
}
