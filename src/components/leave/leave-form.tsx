import type { ReactNode } from "react";
import { Letterhead } from "@/components/documents/letterhead";
import { SignoffBoxes } from "@/components/signoffs/signoff-boxes";
import {
  appDateValue,
  formatFormDate,
  formatLetterDate,
} from "@/lib/datetime/format";
import { leaveTypeLabel, type LeaveDocument } from "@/lib/vacation/types";

const cell = "border border-black px-1.5 py-1 align-top";
const label = `${cell} w-[22%]`;
const sheet =
  "mx-auto w-full max-w-[210mm] bg-white p-8 text-[12px] text-black shadow-sm print:max-w-none print:p-0 print:shadow-none";

function Band({ children }: { children: ReactNode }) {
  return (
    <p className="border-x border-black py-0.5 text-center font-bold">
      {children}
    </p>
  );
}

/**
 * The Leave Request Application, laid out like the company's paper form
 * (two A4 pages). What is on screen is what prints.
 */
export function LeaveForm({ leave }: { leave: LeaveDocument }) {
  const { employee } = leave;
  const isWorkshop = employee.department.includes("Workers");

  return (
    <div className="print-exact flex flex-col gap-6 print:gap-0">
      <section className={`${sheet} print:break-after-page`}>
        <Letterhead company={leave.company} />

        <div className="mt-4 border-x border-t border-black py-1 text-center font-bold">
          <p className="text-[14px] uppercase">{leave.company.name}</p>
          <p>LEAVE REQUEST APPLICATION{isWorkshop ? " WORKSHOP STAFF" : ""}</p>
        </div>
        <table className="w-full table-fixed border-collapse">
          <tbody>
            <tr>
              <td className={label}>Name</td>
              <td className={`${cell} uppercase`}>{leave.staffName}</td>
              <td className={label}>Local Contact No</td>
              <td className={cell}>{employee.localContact}</td>
            </tr>
            <tr>
              <td className={label}>Designation</td>
              <td className={`${cell} uppercase`}>{employee.designation}</td>
              <td className={label}>Home Country contact number</td>
              <td className={cell}>{employee.homeCountryContact}</td>
            </tr>
            <tr>
              <td className={label}>Department</td>
              <td className={`${cell} uppercase`}>{employee.department}</td>
              <td className={label}>PASSPORT NUMBER</td>
              <td className={cell}>{employee.passportNumber}</td>
            </tr>
          </tbody>
        </table>

        <Band>LEAVE REQUIREMENT</Band>
        <table className="w-full table-fixed border-collapse">
          <tbody>
            <tr>
              <td className={label}>Leave Requested for</td>
              <td className={`${cell} text-center`}>
                {leave.dayCount || ""}
              </td>
              <td className={label}>DAYS</td>
              <td className={cell} />
            </tr>
            <tr>
              <td className={label}>Leave to be availed from</td>
              <td className={`${cell} text-center`}>
                {formatFormDate(leave.startDate)}
              </td>
              <td className={label}>Date of Departure</td>
              <td className={`${cell} text-center`}>
                {formatFormDate(leave.startDate)}
              </td>
            </tr>
            <tr>
              <td className={label}>Last day of leave</td>
              <td className={`${cell} text-center`}>
                {formatFormDate(leave.endDate)}
              </td>
              <td className={label}>Date of Return :</td>
              <td className={`${cell} text-center`}>
                {formatFormDate(leave.returnDate)}
              </td>
            </tr>
            <tr>
              <td className={label}>Types of Leave</td>
              <td className={`${cell} text-center uppercase`} colSpan={3}>
                {leaveTypeLabel(leave.leaveType)}
              </td>
            </tr>
          </tbody>
        </table>

        <Band>REASON FOR LEAVE</Band>
        <table className="w-full table-fixed border-collapse">
          <tbody>
            <tr>
              <td className={label}>
                Date : {formatFormDate(appDateValue(new Date(leave.createdAt)))}
              </td>
              <td className={`${cell} uppercase`}>
                Reason : {leave.reason || leaveTypeLabel(leave.leaveType)}
              </td>
              <td className={`${cell} h-16 w-[30%]`}>Signature of Employee</td>
            </tr>
          </tbody>
        </table>

        <Band>OFFICE USE ONLY</Band>
        <table className="w-full table-fixed border-collapse">
          <tbody>
            <tr>
              <td className={label}>Joining Date in {leave.company.name}</td>
              <td className={`${cell} text-center`}>
                {formatFormDate(employee.joinedOn)}
              </td>
            </tr>
            <tr>
              <td className={label}>Came back from vacation previously Date</td>
              <td className={`${cell} text-center`}>
                {employee.previousReturn
                  ? formatFormDate(employee.previousReturn)
                  : leave.staffId
                    ? "Not went for Vacation"
                    : ""}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={sheet}>
        <table className="w-full table-fixed border-collapse">
          <tbody>
            <tr>
              <td className={label}>
                Working Duration in {leave.company.name}
              </td>
              <td className={`${cell} text-center`}>
                {employee.workingDuration}
              </td>
            </tr>
            <tr>
              <td className={label}>Job to be handled by</td>
              <td className={cell}>{leave.jobHandledBy}</td>
            </tr>
            <tr>
              <td className={label}>Leave approved</td>
              <td className={cell}>
                {leave.status === "approved"
                  ? "Yes"
                  : leave.status === "rejected"
                    ? "No"
                    : "Yes / No"}
              </td>
            </tr>
            <tr>
              <td className={label}>Comments if any</td>
              <td className={cell}>{leave.officeComments}</td>
            </tr>
            <tr>
              <td className={label}>Leave Available No of Days</td>
              <td className={cell}>{leave.leaveAvailableDays ?? ""}</td>
            </tr>
            <tr>
              <td className={label}>Leave Approved No of Days</td>
              <td className={cell}>
                {leave.status === "approved" ? leave.dayCount : ""}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-3 leading-relaxed">
          <p>Dear Management,</p>
          <p className="mt-1">
            Please accept this letter as my formal application for{" "}
            {leaveTypeLabel(leave.leaveType).toLowerCase()} from [
            {formatLetterDate(leave.startDate)}] to [
            {formatLetterDate(leave.endDate)}].
          </p>
          <p>
            I plan to resume my regular duties and work responsibilities on [
            {formatLetterDate(leave.returnDate)}].
          </p>
          {leave.reason ? <p>Reason for this leave: {leave.reason}.</p> : null}
          <p>
            Before my departure, I am fully committed to ensuring that all
            ongoing works, and my duties are properly organized and up to date.
          </p>
        </div>

        <div className="mt-4">
          <SignoffBoxes steps={leave.signoffs.steps} />
        </div>
        <p className="mt-2 font-semibold">
          Note : All the staffs are strictly advised to join on or before the
          approved leave days. For any deviation, specific approval is required.
        </p>
      </section>
    </div>
  );
}
