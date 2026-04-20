export { deriveDefaultRole, ROLE_PRECEDENCE } from '../../../convex/lib/rolePrecedence'
export type { StakeholderRole } from '../../../convex/lib/validators'
export { effectiveResourceType } from '../../../convex/lib/validators'

import { ROLE_BY_CLERK_ROLE, type ClerkRole, type RoleClass } from '@/lib/constants/roles'

export function deriveRoleClass(selectedRoles: ClerkRole[]): RoleClass {
  if (selectedRoles.length === 0) {
    throw new Error('deriveRoleClass: selectedRoles is empty')
  }
  for (const role of selectedRoles) {
    if (ROLE_BY_CLERK_ROLE[role].roleClass === 'business') return 'business'
  }
  return 'freelance'
}
