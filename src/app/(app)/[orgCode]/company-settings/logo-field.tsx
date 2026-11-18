"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { imageFileToDataUrl } from "@/components/signoffs/signature-pad";
import { unwrap } from "@/lib/actions/result";
import { saveCompanyLogoAction } from "@/lib/company-settings/actions";

/** The logo printed on the company's forms. Saves as soon as one is chosen. */
export function LogoField({
  orgCode,
  initialLogo,
}: {
  orgCode: string;
  initialLogo: string | null;
}) {
  const { showToast } = useToast();
  const [logo, setLogo] = useState(initialLogo);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(next: () => Promise<string | null>) {
    setError(null);
    setPending(true);
    try {
      const image = await next();
      await unwrap(saveCompanyLogoAction(orgCode, image));
      setLogo(image);
      showToast(image ? "Logo saved" : "Logo removed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="field-label">
        Logo on printed forms
      </span>
      <div className="flex flex-wrap items-center gap-3">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing to optimise
          <img
            src={logo}
            alt="Company logo"
            className="card h-16 p-1"
          />
        ) : (
          <span className="text-sm text-slate-500">No logo yet.</span>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg"
          disabled={pending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void save(() => imageFileToDataUrl(file, 600));
            event.target.value = "";
          }}
          className="text-sm"
        />
        {logo ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => save(async () => null)}
            className="btn btn-secondary btn-sm"
          >
            Remove
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
