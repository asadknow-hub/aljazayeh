/** A position on the chart, with what the paperwork asks of it. */
export type ChartPosition = {
  id: string;
  /** "owners", or the department it belongs to. */
  block: string;
  title: string;
  /** The role it signs the company's forms in, if any. */
  signsAs: string | null;
  staffId: string | null;
  staffName: string;
  /** The forms it signs, by name. */
  signs: string[];
  /** The inquiry steps it approves, by name. */
  approves: string[];
};

export type ChartDepartment = {
  key: string;
  label: string;
  positions: ChartPosition[];
  /** Active staff in the department. */
  staff: string[];
  /** The inquiry steps it prepares, by name. */
  prepares: string[];
};

/** Someone who can be given a position: active, with a login. */
export type PositionCandidate = {
  id: string;
  fullName: string;
  jobTitle: string;
  departmentKeys: string[];
};

export type OrganizationChart = {
  owners: ChartPosition[];
  /** Accounts first, then every other department the company has. */
  departments: ChartDepartment[];
  /** Departments the system offers that this company does not have. */
  closedDepartments: { key: string; label: string }[];
  /** Signing roles no position on the chart fills, so the forms skip them. */
  unfilledRoles: { key: string; title: string; signs: string[] }[];
  candidates: PositionCandidate[];
  canEdit: boolean;
};

export type PositionInput = {
  block: string;
  title: string;
  /** A signing role to fill, or empty. */
  signsAs: string;
  /** Who holds it, or empty for nobody yet. */
  staffId: string;
};
