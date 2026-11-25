/**
 * Sign-off chains: who signs which document, in what order.
 *
 * The company's forms end with a row of signature boxes. A chain says which
 * boxes a form has. Who signs each box comes from the organisation chart
 * (src/lib/organization): "owners" stands for every owner on the chart, in
 * their order, and a role stands for the position that signs in that role.
 * A role nobody on the chart signs in has no box.
 */

/** The roles the forms call for besides the owners and whoever raises them. */
export const SIGNING_ROLES = [
  { key: "admin", title: "Admin" },
  { key: "purchaser", title: "Purchaser" },
  { key: "foreman", title: "Foreman" },
  { key: "accountant", title: "Accountant" },
] as const;

export type SigningRole = (typeof SIGNING_ROLES)[number]["key"];

export function isSigningRole(value: string): value is SigningRole {
  return SIGNING_ROLES.some((role) => role.key === value);
}

/**
 * One part of a chain. "preparer" is whoever raised the document; it is
 * signed for them when they submit it. A role is one box, with the heading
 * the paper form has over it. "owners" is one box per owner, headed with
 * `label` and the owner's title: "Approved by Managing Director".
 */
export type ChainStep = {
  signer: "preparer" | "owners" | SigningRole;
  label: string;
};

const OWNERS_APPROVE: ChainStep = { signer: "owners", label: "Approved by" };

export const DOCUMENT_CHAINS = {
  leave_request: [
    { signer: "preparer", label: "Prepared By" },
    { signer: "foreman", label: "Forman" },
    { signer: "accountant", label: "Signature of Accountant" },
    { signer: "owners", label: "Signature of" },
  ],
  fine_notice: [
    { signer: "admin", label: "Verified by Admin" },
    { signer: "accountant", label: "Verified by Accounts" },
    OWNERS_APPROVE,
  ],
  medical_claim: [
    { signer: "accountant", label: "Verified by Accounts" },
    OWNERS_APPROVE,
  ],
  petty_cash: [
    { signer: "preparer", label: "Prepared By" },
    { signer: "accountant", label: "Verified by Accounts" },
    OWNERS_APPROVE,
  ],
  material_request: [
    { signer: "foreman", label: "Verified by Forman" },
    { signer: "purchaser", label: "Verified by Purchaser" },
    { signer: "accountant", label: "Verified by Accounts" },
    OWNERS_APPROVE,
  ],
  verbal_work_approval: [
    { signer: "foreman", label: "Verified by Forman" },
    { signer: "purchaser", label: "Verified by Purchaser" },
    { signer: "accountant", label: "Verified by Account" },
    OWNERS_APPROVE,
  ],
  // Whoever files the day's sheet, the owners who approve it, and the
  // accountant who pays it out.
  overtime: [
    { signer: "preparer", label: "Prepared By" },
    OWNERS_APPROVE,
    { signer: "accountant", label: "Cleared by Accountant" },
  ],
} as const satisfies Record<string, readonly ChainStep[]>;

export type DocumentType = keyof typeof DOCUMENT_CHAINS;

export const DOCUMENT_TYPES = Object.keys(DOCUMENT_CHAINS) as DocumentType[];

/** The block of the organisation chart the owners are in. */
export const OWNERS_BLOCK = "owners";

/** The key of the box that whoever raises a document signs. */
export const PREPARER_KEY = "preparer";

/** A position of the organisation chart, as far as signing is concerned. */
export type SigningPosition = {
  id: string;
  /** "owners", or the department it belongs to. */
  block: string;
  title: string;
  signsAs: string | null;
  staffId: string | null;
  staffName: string;
};

/** A signature box of a document, with who is to sign it today. */
export type ChainBox = {
  /** `PREPARER_KEY`, or the id of the position that signs it. */
  key: string;
  label: string;
  /** The position's holder; nobody for the preparer's box. */
  staffId: string | null;
  staffName: string;
  /** What the position is called, for saying who is missing. */
  title: string;
};

/**
 * The boxes a document has today: its chain, filled in from the positions
 * on the chart (given in chart order).
 */
export function resolveChain(
  type: DocumentType,
  positions: readonly SigningPosition[],
): ChainBox[] {
  const boxOf = (position: SigningPosition, label: string): ChainBox => ({
    key: position.id,
    label,
    staffId: position.staffId,
    staffName: position.staffName,
    title: position.title,
  });

  return DOCUMENT_CHAINS[type].flatMap((step: ChainStep): ChainBox[] => {
    if (step.signer === "preparer") {
      return [
        {
          key: PREPARER_KEY,
          label: step.label,
          staffId: null,
          staffName: "",
          title: step.label,
        },
      ];
    }
    if (step.signer === "owners") {
      return positions
        .filter((position) => position.block === OWNERS_BLOCK)
        .map((owner) => boxOf(owner, `${step.label} ${owner.title}`));
    }
    return positions
      .filter((position) => position.signsAs === step.signer)
      .map((position) => boxOf(position, step.label));
  });
}

/** The documents a position signs: every one for an owner, by role otherwise. */
export function documentsSignedBy(
  position: Pick<SigningPosition, "block" | "signsAs">,
): DocumentType[] {
  return DOCUMENT_TYPES.filter((type) =>
    DOCUMENT_CHAINS[type].some((step: ChainStep) =>
      position.block === OWNERS_BLOCK
        ? step.signer === "owners"
        : step.signer === position.signsAs,
    ),
  );
}

export type SignoffDecision = "approved" | "rejected";

/** A signature box as shown on a document. */
export type SignoffStepView = {
  label: string;
  /** The box of whoever raised the document. */
  preparer: boolean;
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

/**
 * The first box somebody has to approve: a new document goes to them when it
 * is sent, the preparer's own box being signed as it is raised.
 */
export function firstApprover(
  steps: SignoffStepView[],
): SignoffStepView | null {
  return steps.find((step) => !step.preparer) ?? null;
}

export const APPROVAL_PIN_PATTERN = /^\d{4,6}$/;
/** Largest signature image accepted, as a data URL. */
export const MAX_SIGNATURE_LENGTH = 200_000;
