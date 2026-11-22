import type { ReactElement } from "react";
import type { DepartmentKey } from "@/lib/departments/catalog";

type IconProps = {
  accent: string;
  className?: string;
};

function SoftShape({
  d,
  fill,
  opacity = 1,
}: {
  d: string;
  fill: string;
  opacity?: number;
}) {
  return <path d={d} fill={fill} opacity={opacity} />;
}

export function StaffIcon({ accent, className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <circle cx="24" cy="22" r="8" fill={accent} opacity="0.9" />
      <circle cx="40" cy="24" r="7" fill={accent} opacity="0.55" />
      <path
        d="M10 48c2-10 10-15 14-15s12 5 14 15"
        fill={accent}
        opacity="0.85"
      />
      <path d="M30 50c2-9 8-13 11-13s9 4 11 13" fill={accent} opacity="0.45" />
    </svg>
  );
}

export function AccountsIcon({ accent, className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <circle cx="32" cy="32" r="20" fill={accent} opacity="0.18" />
      <path d="M24 20h4v24h-4zm12 0h4v24h-4z" fill={accent} opacity="0.9" />
      <path
        d="M18 30h28v4H18zm0 0 24-12 4 8-24 12z"
        fill={accent}
        opacity="0.55"
      />
      <circle cx="44" cy="20" r="5" fill={accent} />
    </svg>
  );
}

export function ReceptionIcon({ accent, className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect
        x="14"
        y="28"
        width="36"
        height="18"
        rx="3"
        fill={accent}
        opacity="0.85"
      />
      <path d="M20 28v-6a12 12 0 0 1 24 0v6" fill={accent} opacity="0.45" />
      <rect x="30" y="14" width="4" height="8" rx="1" fill={accent} />
      <circle cx="32" cy="12" r="3" fill={accent} />
    </svg>
  );
}

export function SalesIcon({ accent, className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <SoftShape
        d="M12 44 24 28l10 8 18-22v30H12z"
        fill={accent}
        opacity={0.35}
      />
      <path
        d="M14 40 26 26l9 7 15-18"
        fill="none"
        stroke={accent}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="15" r="5" fill={accent} />
    </svg>
  );
}

export function EngineeringIcon({ accent, className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <circle cx="32" cy="32" r="10" fill={accent} opacity="0.35" />
      <path
        d="M32 12l3 7 8-1 1 8 7 3-3 7 1 8-8 1-3 7-7-3-8 1-3-7-7-3 3-7-1-8 8-1 3-7z"
        fill={accent}
        opacity="0.75"
      />
      <circle cx="32" cy="32" r="6" fill="#fff" />
      <circle cx="32" cy="32" r="3.5" fill={accent} />
    </svg>
  );
}

export function CompanySettingsIcon({ accent, className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect
        x="14"
        y="16"
        width="36"
        height="32"
        rx="4"
        fill={accent}
        opacity="0.2"
      />
      <path
        d="M22 26h20v3H22zm0 8h14v3H22zm0 8h18v3H22z"
        fill={accent}
        opacity="0.9"
      />
      <circle cx="44" cy="42" r="8" fill={accent} opacity="0.85" />
      <path
        d="M44 37v3.2l2.2-1.3 1.5 2.6-2.2 1.3 2.2 1.3-1.5 2.6-2.2-1.3V48h-3v-3.2l-2.2 1.3-1.5-2.6 2.2-1.3-2.2-1.3 1.5-2.6 2.2 1.3V37h3z"
        fill="#fff"
      />
    </svg>
  );
}

export function AdminIcon({ accent, className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path
        d="M32 10 50 18v12c0 12.5-8.6 23.4-18 26-9.4-2.6-18-13.5-18-26V18L32 10z"
        fill={accent}
        opacity="0.22"
      />
      <path
        d="M32 14 46 20.2V30c0 10.2-7 19.1-14 21.6C25 49.1 18 40.2 18 30V20.2L32 14z"
        fill={accent}
        opacity="0.85"
      />
      <path
        d="M28.5 32.5 31 35l6.5-7"
        fill="none"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AllLogsIcon({ accent, className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect
        x="12"
        y="14"
        width="40"
        height="36"
        rx="3"
        fill={accent}
        opacity="0.18"
      />
      <path
        d="M12 22h40M12 30h40M12 38h40M20 14v36"
        stroke={accent}
        strokeWidth="2.5"
      />
      <rect x="24" y="24" width="10" height="4" fill={accent} opacity="0.85" />
      <rect x="38" y="32" width="8" height="4" fill={accent} opacity="0.55" />
      <rect x="24" y="40" width="14" height="4" fill={accent} opacity="0.7" />
    </svg>
  );
}

/** A stack of papers, the front one with its lines of writing. */
export function CompanyDocsIcon({ accent, className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect
        x="20"
        y="10"
        width="30"
        height="40"
        rx="3"
        fill={accent}
        opacity="0.18"
      />
      <rect
        x="14"
        y="16"
        width="30"
        height="40"
        rx="3"
        fill="#fff"
        stroke={accent}
        strokeWidth="2.5"
      />
      <path
        d="M20 26h18M20 33h18M20 40h11"
        stroke={accent}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect x="20" y="46" width="8" height="4" fill={accent} opacity="0.7" />
    </svg>
  );
}

const ICONS: Record<DepartmentKey, (props: IconProps) => ReactElement> = {
  staff: StaffIcon,
  accounts: AccountsIcon,
  reception: ReceptionIcon,
  sales: SalesIcon,
  engineering: EngineeringIcon,
  admin: AdminIcon,
  "company-docs": CompanyDocsIcon,
  "all-logs": AllLogsIcon,
  "company-settings": CompanySettingsIcon,
};

export function DepartmentIcon({
  departmentKey,
  accent,
  className,
}: {
  departmentKey: DepartmentKey;
  accent: string;
  className?: string;
}) {
  const Icon = ICONS[departmentKey];
  return <Icon accent={accent} className={className} />;
}
