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

export function DiveSiteIcon(props: RoleIconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2a6 6 0 0 0-6 6c0 4 6 10 6 10s6-6 6-10a6 6 0 0 0-6-6z" />
      <circle cx="12" cy="8" r="2" />
      <path d="M3 21q3-2 6 0t6 0t6 0" />
    </IconBase>
  )
}

export function InstructorIcon(props: RoleIconProps) {
  return (
    <IconBase {...props}>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11v4c0 3 3 5 6 5s6-2 6-5v-4" />
      <path d="M22 9v6" />
    </IconBase>
  )
}

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

export function EquipmentIcon(props: RoleIconProps) {
  return (
    <IconBase {...props}>
      <circle cx="8" cy="11" r="3" />
      <circle cx="16" cy="11" r="3" />
      <path d="M11 11h2" />
      <path d="M5 8c-1 0-2.5 0.5-3 1" />
      <path d="M19 8c1 0 2.5 0.5 3 1" />
    </IconBase>
  )
}

export function PoolIcon(props: RoleIconProps) {
  return (
    <IconBase {...props}>
      <path d="M2 7q3-3 6 0t6 0t6 0" />
      <path d="M2 12q3-3 6 0t6 0t6 0" />
      <path d="M2 17q3-3 6 0t6 0t6 0" />
    </IconBase>
  )
}

export function CompressorIcon(props: RoleIconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 3h6" />
      <path d="M12 3v3" />
      <path d="M8 9c0-2 2-3 4-3s4 1 4 3v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" />
      <path d="M8 11h8" />
    </IconBase>
  )
}
