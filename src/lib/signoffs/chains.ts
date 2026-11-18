/**
 * Sign-off chains: who signs which document, in what order.
 *
 * The company's forms end with a row of signature boxes (Foreman, Accounts,
 * Managing Partner, Managing Director, …). A chain is that row. Each box is
 * a position; Company Settings says which person holds each position.
 */

export const SIGNATORY_POSITIONS = [
  { key: "admin", label: "Admin" },
  { key: "foreman", label: "Foreman" },
  { key: "purchaser", label: "Purchaser" },
  { key: "accountant", label: "Accountant" },
  { key: "managing_partner", label: "CEO & Managing Partner" },
  { key: "managing_director", label: "Managing Director" },
] as const;

export type PositionKey = (typeof SIGNATORY_POSITIONS)[number]["key"];

export function isPositionKey(value: string): value is PositionKey {
  return SIGNATORY_POSITIONS.some((position) => position.key === value);
}

export function positionLabel(key: PositionKey): string {
  return SIGNATORY_POSITIONS.find((position) => position.key === key)!.label;
}

/**
 * One signature box. "preparer" is whoever raised the document; it is
 * signed for them when they submit it. Every other step waits for the
 * holder of its position.
 */
export type ChainStep = {
  signer: PositionKey | "preparer";
  /** The heading printed over the box, as on the paper form. */
  label: string;
};

export const DOCUMENT_CHAINS = {
  leave_request: [
    { signer: "preparer", label: "Prepared By" },
    { signer: "foreman", label: "Forman" },
    { signer: "accountant", label: "Signature of Accountant" },
    {
      signer: "managing_partner",
      label: "Signature of CEO & Managing Partner",
    },
    { signer: "managing_director", label: "Signature of Managing Director" },
  ],
  fine_notice: [
    { signer: "admin", label: "Verified by Admin" },
    { signer: "accountant", label: "Verified by Accounts" },
    { signer: "managing_partner", label: "Approved by Managing Partner" },
    { signer: "managing_director", label: "Approved by Managing Director" },
  ],
  medical_claim: [
    { signer: "accountant", label: "Verified by Accounts" },
    { signer: "managing_partner", label: "Approved by Managing Partner" },
    { signer: "managing_director", label: "Approved by Managing Director" },
  ],
  petty_cash: [
    { signer: "preparer", label: "Prepared By" },
    { signer: "accountant", label: "Verified by Accounts" },
    { signer: "managing_partner", label: "Approved by Managing Partner" },
    { signer: "managing_director", label: "Approved by Managing Director" },
  ],
  material_request: [
    { signer: "foreman", label: "Verified by Forman" },
    { signer: "purchaser", label: "Verified by Purchaser" },
    { signer: "accountant", label: "Verified by Accounts" },
    { signer: "managing_partner", label: "Approved by Managing Partner" },
    { signer: "managing_director", label: "Approved by Managing Director" },
  ],
  verbal_work_approval: [
    { signer: "foreman", label: "Verified by Forman" },
    { signer: "purchaser", label: "Verified by Purchaser" },
    { signer: "accountant", label: "Verified by Account" },
    { signer: "managing_partner", label: "Approved by Managing Partner & CEO" },
    { signer: "managing_director", label: "Approved by Managing Director" },
  ],
} as const satisfies Record<string, readonly ChainStep[]>;

export type DocumentType = keyof typeof DOCUMENT_CHAINS;

export type SignoffDecision = "approved" | "rejected";

/** A signature box as shown on a document. */
export type SignoffStepView = {
  label: string;
  /** Who is expected to sign: the position holder, or the preparer. */
  expectedName: string;
  signed: {
    decision: SignoffDecision;
    name: string;
    signatureImage: string | null;
    remarks: string;
    signedAt: string;
  } | null;
};

export type SignoffState = {
  steps: SignoffStepView[];
  status: "pending" | "approved" | "rejected";
  /** The box that is next to be signed, if the document is still pending. */
  waitingFor: string | null;
  /** The signed-in person is the one who signs next. */
  canSign: boolean;
};

export const APPROVAL_PIN_PATTERN = /^\d{4,6}$/;
/** Largest signature image accepted, as a data URL. */
export const MAX_SIGNATURE_LENGTH = 200_000;
