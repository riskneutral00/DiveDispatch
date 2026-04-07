import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'

export function groupRolesByHierarchy(roles: ClerkRole[]): ClerkRole[][] {
  if (roles.length === 0) return []

  const operators: ClerkRole[] = []
  const resources: ClerkRole[] = []

  for (const role of roles) {
    const cfg = ROLE_BY_CLERK_ROLE[role]
    if (!cfg) continue
    if (cfg.isOrganizer) {
      operators.push(role)
    } else {
      resources.push(role)
    }
  }

  if (operators.length > 0) {
    const trees: ClerkRole[][] = []
    trees.push([operators[0], ...resources])
    for (let i = 1; i < operators.length; i++) {
      trees.push([operators[i]])
    }
    return trees
  }

  return resources.map((r) => [r])
}

export function hasMultipleHierarchies(roles: ClerkRole[]): boolean {
  return groupRolesByHierarchy(roles).length > 1
}
