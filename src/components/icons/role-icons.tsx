import type { SVGProps, ReactNode } from 'react'

export type RoleIconProps = SVGProps<SVGSVGElement> & { size?: number }

function IconBase({
  size = 24,
  children,
  ...rest
}: RoleIconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  )
}

// ── Organizer Icons ──────────────────────────────────────────────────────────

/** Storefront with person overlay (bottom-right) */
export function DiveCenterIcon(props: RoleIconProps) {
  return (
    <IconBase {...props}>
      <path d="M2 10Q4 6 6 10Q8 6 10 10Q12 6 14 10Q16 6 18 10" />
      <path d="M3 10v11h14V10" />
      <path d="M8 15v6h4v-6" />
      <circle cx="20.5" cy="15.5" r="1.5" />
      <path d="M18 21a2.5 2.5 0 0 1 5 0" />
    </IconBase>
  )
}

/** Clipboard with person overlay (bottom-right) */
export function AgentIcon(props: RoleIconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="4" width="12" height="17" rx="1" />
      <path d="M8 2h4v3H8z" />
      <path d="M7 9h6M7 12h4" />
      <circle cx="20" cy="16" r="1.5" />
      <path d="M17.5 22a2.5 2.5 0 0 1 5 0" />
    </IconBase>
  )
}

/** Boat hull with person overlay (bottom-right) */
export function LiveaboardIcon(props: RoleIconProps) {
  return (
    <IconBase {...props}>
      <path d="M2 16c1 3 5 4 8 4s7-1 8-4" />
      <path d="M6 16V10h8v6" />
      <path d="M10 10V6" />
      <circle cx="20.5" cy="16.5" r="1.5" />
      <path d="M18 22a2.5 2.5 0 0 1 5 0" />
    </IconBase>
  )
}

/** Hotel building with wave at bottom */
export function DiveResortIcon(props: RoleIconProps) {
  return (
    <IconBase {...props}>
      <rect x="5" y="3" width="10" height="15" rx="0.5" />
      <path d="M5 8h10M5 13h10" />
      <path d="M8 5v2M12 5v2M8 10v2M12 10v2" />
      <path d="M9 18v-3h2v3" />
      <path d="M2 21q3-2 6 0t6 0t6 0" />
    </IconBase>
  )
}

/** Bunk bed frame with pillows */
export function DiveHostelIcon(props: RoleIconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 3h12v18H4z" />
      <path d="M4 11h12" />
      <rect x="6" y="7" width="4" height="2.5" rx="1" />
      <rect x="6" y="14.5" width="4" height="2.5" rx="1" />
      <path d="M18 11v10M16 14h2M16 17h2" />
    </IconBase>
  )
}

/** Map pin with wave at bottom */
export function DiveSiteIcon(props: RoleIconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2a6 6 0 0 0-6 6c0 4 6 10 6 10s6-6 6-10a6 6 0 0 0-6-6z" />
      <circle cx="12" cy="8" r="2" />
      <path d="M3 21q3-2 6 0t6 0t6 0" />
    </IconBase>
  )
}

// ── Resource Icons ───────────────────────────────────────────────────────────

/** Graduation cap / mortarboard */
export function InstructorIcon(props: RoleIconProps) {
  return (
    <IconBase {...props}>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11v4c0 3 3 5 6 5s6-2 6-5v-4" />
      <path d="M22 9v6" />
    </IconBase>
  )
}

/** Dive mask with snorkel */
export function DiveMasterIcon(props: RoleIconProps) {
  return (
    <IconBase {...props}>
      <ellipse cx="12" cy="11" rx="7" ry="4.5" />
      <path d="M10 13.5v2h4v-2" />
      <path d="M5 9H3M19 9h2" />
      <path d="M19 11V5c0-1.5 1-2.5 2.5-2.5" />
    </IconBase>
  )
}

/** Boat hull with cabin and wave */
export function BoatIcon(props: RoleIconProps) {
  return (
    <IconBase {...props}>
      <path d="M2 14c1 2 5 3 10 3s9-1 10-3" />
      <path d="M7 14V9h6v5" />
      <path d="M9 9V6h3v3" />
      <path d="M2 20q3-2 6 0t6 0t6 0" />
    </IconBase>
  )
}

/** Scuba tank with valve */
export function EquipmentIcon(props: RoleIconProps) {
  return (
    <IconBase {...props}>
      <rect x="8" y="6" width="8" height="14" rx="3" />
      <path d="M10 6V4h4v2" />
      <path d="M9 3h6" />
      <path d="M9 20h6" />
    </IconBase>
  )
}

/** Wave lines */
export function PoolIcon(props: RoleIconProps) {
  return (
    <IconBase {...props}>
      <path d="M2 7q3-3 6 0t6 0t6 0" />
      <path d="M2 12q3-3 6 0t6 0t6 0" />
      <path d="M2 17q3-3 6 0t6 0t6 0" />
    </IconBase>
  )
}

/** Interlocking gears */
export function CompressorIcon(props: RoleIconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10" cy="10" r="3" />
      <path d="M10 4v2.5M16 10h-2.5M10 16v-2.5M4 10h2.5M14.2 5.8l-2.1 2.1M14.2 14.2l-2.1-2.1M5.8 14.2l2.1-2.1M5.8 5.8l2.1 2.1" />
      <circle cx="18" cy="18" r="2" />
      <path d="M18 14.5v1.5M21.5 18h-1.5M18 21.5v-1.5M14.5 18h1.5" />
    </IconBase>
  )
}
