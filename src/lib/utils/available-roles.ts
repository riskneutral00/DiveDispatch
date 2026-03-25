import { ROLES, type RoleConfig, type ClerkRole } from '@/lib/constants/roles'

/**
 * Returns roles the user does NOT already hold.
 * Used by the "Add Role" modal to filter the role grid.
 */
export function getAvailableRoles(heldRoles: ClerkRole[]): RoleConfig[] {
  const heldSet = new Set<string>(heldRoles)
  return ROLES.filter((r) => !heldSet.has(r.clerkRole))
}
