import { appDateValue, formatFormDate } from "@/lib/datetime/format";
import type { SignoffStepView } from "@/lib/signoffs/chains";

const cell = "border border-black px-1.5 py-1 align-top";

/**
 * The row of signature boxes at the foot of a form. A signed box shows the
 * signer's saved signature, their name and the date; the rest stay empty.
 */
export function SignoffBoxes({ steps }: { steps: SignoffStepView[] }) {
  return (
    <table className="w-full table-fixed border-collapse text-[11px]">
      <tbody>
        <tr>
          {steps.map((step) => (
            <td key={step.label} className={`${cell} h-12 font-semibold`}>
              <span className="block uppercase">
                {step.signed?.name ?? step.expectedName}
              </span>
              {step.label}
            </td>
          ))}
        </tr>
        <tr>
          {steps.map((step) => (
            <td key={step.label} className={`${cell} h-20`}>
              <span className="block">Signature</span>
              {step.signed?.decision === "rejected" ? (
                <span className="mt-1 block font-bold uppercase text-red-700">
                  Rejected
                </span>
              ) : step.signed?.signatureImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing to optimise
                <img
                  src={step.signed.signatureImage}
                  alt={`Signature of ${step.signed.name}`}
                  className="mx-auto h-12 w-auto"
                />
              ) : step.signed ? (
                <span className="mt-1 block italic">Signed electronically</span>
              ) : null}
            </td>
          ))}
        </tr>
        <tr>
          {steps.map((step) => (
            <td key={step.label} className={cell}>
              Date{" "}
              {step.signed
                ? formatFormDate(appDateValue(new Date(step.signed.signedAt)))
                : ""}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
