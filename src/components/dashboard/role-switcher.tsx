'use client'

import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import {
  ROLE_BY_CLERK_ROLE,
  type ClerkRole,
  type RoleKey,
} from '@/lib/constants/roles'
import { GlassTooltip } from '@/components/glass'
import { hasMultipleHierarchies, groupRolesByHierarchy } from '@/lib/utils/role-hierarchy'
import { ROLE_PRECEDENCE } from '@/lib/utils/role'

interface RoleSwitcherProps {
  slug: string
  roleSlug: RoleKey
}

/**
 * Role switcher for users with roles across multiple independent hierarchy
 * trees. Renders a horizontal pill bar showing one representative icon per
 * hierarchy tree, with the active tree visually distinguished.
 *
 * Hidden when:
 * - User has 0 or 1 roles
 * - All roles fall within a single hierarchy tree (HierarchySubBar handles it)
 */
export function RoleSwitcher({ slug, roleSlug }: RoleSwitcherProps) {
  const roles = useQuery(api.userRoles.myRoles)

  // Don't render until loaded
  if (!roles) return null

  const clerkRoles = roles.map((r) => r.role as ClerkRole)

  // Only show when roles span multiple hierarchy trees
  if (!hasMultipleHierarchies(clerkRoles)) return null

  const trees = groupRolesByHierarchy(clerkRoles)

  // Sort roles within each tree by precedence, pick the tree root (first) as representative
  const treeReps = trees.map((tree) => {
    const sorted = [...tree].sort(
      (a, b) => (ROLE_PRECEDENCE[a] ?? Infinity) - (ROLE_PRECEDENCE[b] ?? Infinity),
    )
    return sorted[0]
  })

  return (
    <nav
      aria-label="Role switcher"
      className="flex items-center gap-2 px-4 py-1.5 overflow-x-auto flex-shrink-0 max-w-4xl mx-auto w-full"
      data-testid="role-switcher"
    >
      {treeReps.map((rep, idx) => {
        const cfg = ROLE_BY_CLERK_ROLE[rep]
        if (!cfg) return null

        // A tree is active if the current roleSlug belongs to any role in that tree
        const tree = trees[idx]
        const isActive = tree.some((r) => {
          const c = ROLE_BY_CLERK_ROLE[r]
          return c && c.key === roleSlug
        })
        const Icon = cfg.icon

        return (
          <Link
            key={rep}
            href={`/${slug}/${cfg.key}/dashboard`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all border"
            style={{
              background: isActive ? 'var(--color-accent-glow)' : 'transparent',
              borderColor: isActive ? 'var(--color-accent)' : 'var(--color-glass-border)',
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              transitionDuration: 'var(--transition-speed)',
            }}
            aria-current={isActive ? 'page' : undefined}
          >
            <GlassTooltip label={cfg.label}>
              <span className="flex items-center gap-1.5">
                <Icon size={20} />
                <span>{cfg.label}</span>
              </span>
            </GlassTooltip>
          </Link>
        )
      })}
    </nav>
  )
}
