import { Letterhead } from "@/components/documents/letterhead";
import { SignoffBoxes } from "@/components/signoffs/signoff-boxes";
import type { ApprovalFormDocument } from "@/lib/forms/queries";
import { formTitle, printedForm } from "@/lib/forms/print";

const cell = "border border-black px-1.5 py-1 align-top";
const head = `${cell} bg-[#c8c8c8] text-center font-semibold`;
const band = "border border-black bg-[#c8c8c8] px-1.5 py-0.5 font-semibold";

function Details({ rows }: { rows: [string, string][] }) {
  return (
    <table className="w-full border-collapse">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <td className={`${cell} font-semibold`}>
              {label}: <span className="font-normal uppercase">{value}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * One of the company's signed forms, laid out like its paper version. What
 * is on screen is what prints.
 */
export function ApprovalFormSheet({ form }: { form: ApprovalFormDocument }) {
  const printed = printedForm(form);
  const landscape = printed.orientation === "landscape";

  return (
    <section
      className={[
        "print-exact mx-auto w-full bg-white p-8 text-[12px] text-black shadow-sm print:max-w-none print:p-0 print:shadow-none",
        landscape ? "print-landscape max-w-[297mm]" : "max-w-[210mm]",
      ].join(" ")}
    >
      <Letterhead company={form.company} />

      {printed.letter.length > 0 ? (
        <div className="mt-10 mb-10 flex flex-col gap-4 text-[15px] leading-relaxed">
          {printed.letter.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <p className={`${band} text-center text-[13px]`}>{formTitle(form)}</p>
          <div
            className={
              printed.detailsRight.length > 0 ? "grid grid-cols-[3fr_2fr]" : ""
            }
          >
            <Details rows={printed.details} />
            {printed.detailsRight.length > 0 ? (
              <Details rows={printed.detailsRight} />
            ) : null}
          </div>
        </div>
      )}

      {printed.table ? (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {printed.table.columns.map((column) => (
                <th key={column} className={head}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {printed.table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((value, index) => (
                  <td key={index} className={`${cell} text-center uppercase`}>
                    {value}
                  </td>
                ))}
              </tr>
            ))}
            {printed.table.totals ? (
              <tr>
                {printed.table.totals.map((value, index) => (
                  <td
                    key={index}
                    className={`${cell} text-center font-semibold`}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      ) : null}

      {printed.letter.length === 0 ? (
        <p className={band}>APPROVING AUTHORITY</p>
      ) : null}
      <SignoffBoxes
        steps={form.signoffs.steps}
        employeeBox={printed.employeeBox}
        managingRemarks={printed.managingRemarks}
      />
      {printed.letter.length > 0 ? (
        <p className="mt-2 text-[10px] text-zinc-600">
          Ref No: {form.referenceNo}
        </p>
      ) : null}
    </section>
  );
}
