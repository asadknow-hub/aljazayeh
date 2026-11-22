import type { DepartmentKey, StaffRoleKey } from "@/lib/departments/catalog";
import { UserError } from "@/lib/errors";
import type { InquiryWorkflowDepartmentKey } from "@/lib/inquiries/stages";

/**
 * What the signed-in person is inside one company. It comes from their staff
 * record: whether they are a company administrator and which departments
 * they are in. Every rule about who may do what lives in this file.
 */
export type OrgAccess = {
  staffId: string;
  isAdmin: boolean;
  departments: StaffRoleKey[];
};

function inDepartment(access: OrgAccess, key: StaffRoleKey): boolean {
  return access.departments.includes(key);
}

/** Administrators and Management oversee the whole company. */
function isLeadership(access: OrgAccess): boolean {
  return access.isAdmin || inDepartment(access, "management");
}

export const can = {
  /** Company profile, workflow settings, staff logins. */
  manageCompany: (access: OrgAccess) => access.isAdmin,

  /** Staff directory including salaries and contracts. */
  manageStaff: (access: OrgAccess) => isLeadership(access),

  viewActivityLog: (access: OrgAccess) => isLeadership(access),

  /**
   * Change a paper under Company Docs: its wording, what it asks for and the
   * code in its numbers. Everyone in the company may look.
   */
  editCompanyDocs: (access: OrgAccess) => isLeadership(access),

  /** Visitors log and raising leave requests. */
  useReception: (access: OrgAccess) =>
    isLeadership(access) || inDepartment(access, "reception"),

  /** Open a department's workspace (Admin, Sales, Accounts, Engineering). */
  openDepartment: (access: OrgAccess, dept: InquiryWorkflowDepartmentKey) =>
    isLeadership(access) || inDepartment(access, dept),

  /** See every inquiry in the company, whichever department owns it. */
  viewAllInquiries: (access: OrgAccess) =>
    isLeadership(access) || inDepartment(access, "admin"),

  viewInquiry: (access: OrgAccess, owner: InquiryWorkflowDepartmentKey) =>
    can.viewAllInquiries(access) || inDepartment(access, owner),

  createInquiry: (access: OrgAccess) =>
    access.isAdmin || inDepartment(access, "admin"),

  /** Choose who handles an inquiry. */
  assignInquiry: (access: OrgAccess, owner: InquiryWorkflowDepartmentKey) =>
    isLeadership(access) || inDepartment(access, owner),

  /** Edit, comment on and move an inquiry: the department that owns it. */
  workInquiry: (access: OrgAccess, owner: InquiryWorkflowDepartmentKey) =>
    access.isAdmin || inDepartment(access, owner),
};

/** Whether a tile on the company home screen is available to this person. */
export function canOpenTile(access: OrgAccess, key: DepartmentKey): boolean {
  switch (key) {
    case "staff":
      return can.manageStaff(access);
    case "reception":
      return can.useReception(access);
    case "all-logs":
      return can.viewActivityLog(access);
    case "company-settings":
      return can.manageCompany(access);
    case "company-docs":
      return true;
    default:
      return can.openDepartment(access, key);
  }
}

export function assertCan(allowed: boolean): asserts allowed {
  if (!allowed) {
    throw new UserError("You don't have permission to do that.");
  }
}
