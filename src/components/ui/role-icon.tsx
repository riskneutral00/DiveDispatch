import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { Tooltip } from './tooltip'

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
    return <Tooltip label={cfg.label}>{icon}</Tooltip>
  }

  return icon
}
