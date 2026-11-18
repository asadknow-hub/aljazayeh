/** The company letterhead at the top of printed forms. */
export function Letterhead({
  company,
}: {
  company: { name: string; nameArabic: string; logoImage: string | null };
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-3 flex-1 bg-black" />
      <div className="text-center leading-tight">
        {company.nameArabic ? (
          <p dir="rtl" className="text-[15px] font-bold">
            {company.nameArabic}
          </p>
        ) : null}
        <p className="text-[11px] font-bold uppercase tracking-[0.2em]">
          {company.name}
        </p>
      </div>
      {company.logoImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing to optimise
        <img src={company.logoImage} alt="" className="h-14 w-auto" />
      ) : null}
      <div className="h-3 flex-1 bg-black" />
    </div>
  );
}
