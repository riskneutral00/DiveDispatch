import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'

/**
 * Group roles into hierarchy trees.
 *
 * Each operator (isOrganizer) role is its own tree root. Resource roles
 * (isResource, not isOrganizer) attach to the first operator's tree if one
 * exists. If no operator is present, each resource is an independent tree.
 *
 * Returns an array of arrays, where each inner array is a set of ClerkRole
 * strings that belong to the same hierarchy tree.
 */
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

  // If there are operators, first operator gets all resources in its tree.
  // Each additional operator is a separate tree.
  if (operators.length > 0) {
    const trees: ClerkRole[][] = []
    // First operator + all resources = one tree
    trees.push([operators[0], ...resources])
    // Each additional operator = separate tree
    for (let i = 1; i < operators.length; i++) {
      trees.push([operators[i]])
    }
    return trees
  }

  // No operators: each resource is its own independent tree
  return resources.map((r) => [r])
}

/**
 * Returns true when the user's roles span multiple independent hierarchy
 * trees — meaning HierarchySubBar alone is insufficient and a role switcher
 * should be shown.
 *
 * - 1 operator + N resources = single tree (false)
 * - 2+ operators = multi-tree (true)
 * - 0 operators + 2+ resources = multi-tree (true)
 * - 0 or 1 total roles = false
 */
export function hasMultipleHierarchies(roles: ClerkRole[]): boolean {
  return groupRolesByHierarchy(roles).length > 1
}
