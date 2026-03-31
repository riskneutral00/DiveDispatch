import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { GlassTooltip } from './glass-tooltip'

interface RoleIconComponentProps {
  role: ClerkRole
  size?: number
  showTooltip?: boolean
}

export function RoleIcon({ role, size, showTooltip = false }: RoleIconComponentProps) {
  const cfg = ROLE_BY_CLERK_ROLE[role]
  if (!cfg) return null

  const IconComponent = cfg.icon
  const icon = <IconComponent size={size} />

  if (showTooltip) {
    return <GlassTooltip label={cfg.label}>{icon}</GlassTooltip>
  }

  return icon
}
