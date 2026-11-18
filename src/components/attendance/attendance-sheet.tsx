import {
  attendanceCode,
  isWeeklyOff,
  monthTitle,
  sheetDateLabel,
  type AttendanceCell,
  type AttendanceSheet,
} from "@/lib/attendance/types";

/** Text that reads bottom-to-top, as in the paper sheet's column headings. */
const vertical = "[writing-mode:vertical-rl] rotate-180 whitespace-nowrap";

const cell = "border border-black px-0.5 text-center align-middle";
const headCell = `${cell} bg-[#c8c8c8] font-normal`;

const SHADE: Partial<Record<AttendanceCell, string>> = {
  absent: "bg-[#7f7f7f] font-semibold",
  off: "bg-[#e3e3e3]",
  half_day: "bg-[#e3e3e3]",
  md: "bg-[#e3e3e3]",
  vacation: "bg-[#e3e3e3]",
  not_joined: "bg-[#e3e3e3]",
};

/** Leave and days before joining print as one block across the days. */
function mergeRuns(cells: AttendanceCell[]) {
  const runs: { cell: AttendanceCell; span: number }[] = [];
  for (const value of cells) {
    const last = runs.at(-1);
    const merges = value === "vacation" || value === "not_joined";
    if (last && merges && last.cell === value) last.span += 1;
    else runs.push({ cell: value, span: 1 });
  }
  return runs;
}

/**
 * The monthly Employee Attendance Sheet, laid out like the company's paper
 * form. What is on screen is what prints (A4 landscape).
 */
export function AttendanceSheetView({ sheet }: { sheet: AttendanceSheet }) {
  const columns = sheet.dates.length + 6;

  return (
    <div className="print-landscape print-exact bg-white text-black">
      <table className="w-full min-w-[68rem] table-fixed border-collapse border border-black text-[10px] leading-tight print:min-w-0 print:text-[7.5px]">
        <colgroup>
          <col className="w-[3%]" />
          <col className="w-[15%]" />
          {sheet.dates.map((date) => (
            <col key={date} />
          ))}
          <col className="w-[2.6%]" />
          <col className="w-[2.6%]" />
          <col className="w-[2.6%]" />
          <col className="w-[6%]" />
        </colgroup>
        <thead>
          <tr>
            <th
              colSpan={columns}
              className={`${cell} py-1 text-[17px] font-normal uppercase underline print:text-[14px]`}
            >
              {sheet.companyName}
            </th>
          </tr>
          <tr>
            <th
              colSpan={columns}
              className={`${cell} py-0.5 text-[12px] font-normal print:text-[10px]`}
            >
              EMPLOYEE ATTENDANCE SHEET - {monthTitle(sheet.month)}
            </th>
          </tr>
          <tr className="h-32 print:h-24">
            <th className={headCell}>SL NO</th>
            <th className={headCell}>EMPLOYEE NAME</th>
            {sheet.dates.map((date) => (
              <th key={date} className={headCell}>
                <span className={vertical}>
                  {sheetDateLabel(date)}
                  {isWeeklyOff(date) ? " (FRIDAY)" : ""}
                </span>
              </th>
            ))}
            {[
              "TOTAL PRESENT DAYS",
              "TOTAL ABSENT DAYS",
              "TOTAL HALF DAYS",
              "REMARKS",
            ].map((label) => (
              <th key={label} className={headCell}>
                <span className={vertical}>{label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row, index) => (
            <tr key={row.staffId} className="h-5 print:h-[15px]">
              <td className={cell}>{index + 1}</td>
              <td className={`${cell} truncate !text-left uppercase`}>
                {row.fullName}
              </td>
              {mergeRuns(row.cells).map((run, runIndex) => (
                <td
                  key={runIndex}
                  colSpan={run.span}
                  className={`${cell} ${SHADE[run.cell] ?? ""}`}
                >
                  {attendanceCode(run.cell)}
                </td>
              ))}
              <td className={cell}>{row.totals.present}</td>
              <td className={cell}>{row.totals.absent}</td>
              <td className={cell}>{row.totals.half}</td>
              <td className={cell} />
            </tr>
          ))}
          {sheet.rows.length === 0 ? (
            <tr>
              <td colSpan={columns} className={`${cell} py-4`}>
                No staff on this sheet for the month.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {sheet.notes.length > 0 ? (
        <div className="mt-1 text-[11px] font-semibold print:text-[9px]">
          <p className="underline">NOTES</p>
          <ul>
            {sheet.notes.map((note) => (
              <li key={note}>• {note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
