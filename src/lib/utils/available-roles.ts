import { ROLES, type RoleConfig, type ClerkRole } from '@/lib/constants/roles'

export function getAvailableRoles(heldRoles: ClerkRole[]): RoleConfig[] {
  const heldSet = new Set<string>(heldRoles)
  return ROLES.filter((r) => !heldSet.has(r.clerkRole))
}
