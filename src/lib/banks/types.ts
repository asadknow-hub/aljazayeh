/** What a paper prints about the bank account money is paid into. */
export type BankDetails = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string;
  swift: string;
  branch: string;
};

/** One of the company's bank accounts, kept under Accounts. */
export type BankAccount = BankDetails & {
  id: string;
  /** What it is called when choosing it: "Wio Bank, main account". */
  label: string;
  /** Offered first on new papers. */
  isDefault: boolean;
};

export type BankAccountInput = BankDetails & { label: string };

export const BANK_DETAIL_FIELDS: { key: keyof BankDetails; label: string }[] = [
  { key: "bankName", label: "Bank name" },
  { key: "accountName", label: "Account name" },
  { key: "accountNumber", label: "Account number" },
  { key: "iban", label: "IBAN" },
  { key: "swift", label: "SWIFT code" },
  { key: "branch", label: "Branch" },
];
