import type { BankDetails } from "@/lib/banks/types";
import type { SignedFormKey } from "@/lib/company-docs/catalog";
import type {
  InquiryStageKey,
  InquiryWorkflowDepartmentKey,
} from "@/lib/inquiries/stages";
import type {
  DocumentSettings,
  StepTemplate,
} from "@/lib/inquiries/stage-forms";

/** One paper of the inquiry process, with where and how it is used. */
export type CompanyDocRow = {
  stage: InquiryStageKey;
  document: string;
  name: string;
  kind: "paper" | "details";
  /** For a paper only some jobs need: when it is prepared. */
  onlyWhen: { question: string; answer: string } | null;
  /** What its numbers look like, or nothing if it has none of its own. */
  numberExample: string | null;
  /** How many jobs have it so far. */
  used: number;
  /** 0 while it is still the built-in version. */
  version: number;
  changedAt: string | null;
  changedByName: string | null;
};

/** A step of the inquiry process and the papers prepared in it. */
export type CompanyDocStep = {
  stage: InquiryStageKey;
  label: string;
  /** Its place in a local job and in an export job; null if not part of it. */
  number: { local: number | null; export: number | null };
  departmentKey: InquiryWorkflowDepartmentKey;
  /** Who approves the step: "Owners" or a position's title; empty if nobody. */
  approvalBy: string;
  docs: CompanyDocRow[];
};

/** A form that goes round for signatures. */
export type SignedFormRow = {
  key: SignedFormKey;
  name: string;
  /** Where it is raised, and the page it is raised on. */
  raisedIn: string;
  raisedHref: string;
  /** The signature boxes in order, with who holds each today. */
  signers: { label: string; name: string; preparer: boolean }[];
  numberExample: string | null;
  raised: number;
  waiting: number;
};

export type CompanyDocsOverview = {
  steps: CompanyDocStep[];
  forms: SignedFormRow[];
  canEdit: boolean;
};

export type CompanyDocVersion = {
  version: number;
  createdAt: string;
  byName: string;
  note: string;
};

/** Everything the page of one paper shows. */
export type CompanyDocDetail = {
  step: Omit<CompanyDocStep, "docs">;
  doc: CompanyDocRow;
  /** What the company changed about it, in force now. */
  settings: DocumentSettings;
  /** The settings in force of every step, for showing the paper. */
  templates: Partial<Record<InquiryStageKey, StepTemplate>>;
  /** Newest first. */
  versions: CompanyDocVersion[];
  /** The bank account the sample paper prints: the company's usual one. */
  sampleBank: BankDetails | null;
  canEdit: boolean;
};
