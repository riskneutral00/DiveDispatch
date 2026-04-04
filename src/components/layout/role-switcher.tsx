'use client'

import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import {
  ROLE_BY_CLERK_ROLE,
  ROLE_BY_KEY,
  type ClerkRole,
  type RoleKey,
} from '@/lib/constants/roles'
import { GlassTooltip } from '@/components/ui'
import { hasMultipleHierarchies, groupRolesByHierarchy } from '@/lib/utils/role-hierarchy'
import { ROLE_PRECEDENCE } from '@/lib/utils/role'
import { useCurrentUser } from '@/lib/hooks/use-current-user'

interface RoleSwitcherProps {
  slug: string
  roleSlug: RoleKey
}

/**
 * Compact role switcher bar. Always renders the active role's business name.
 * When the user has roles across multiple hierarchy trees, icon-only tabs
 * appear on the left for cross-tree switching.
 *
 * Hidden only when roles have not loaded yet.
 */
export function RoleSwitcher({ slug, roleSlug }: RoleSwitcherProps) {
  const roles = useQuery(api.userRoles.myRoles)
  const { user } = useCurrentUser()

  // Don't render until roles loaded
  if (!roles) return null

  const clerkRoles = roles.map((r) => r.role as ClerkRole)
  const showTabs = hasMultipleHierarchies(clerkRoles)

  const displayName = user?.businessName ?? ROLE_BY_KEY[roleSlug]?.label ?? ''

  // Build tree representatives for icon tabs (only used when showTabs is true)
  let treeReps: ClerkRole[] = []
  let trees: ClerkRole[][] = []
  if (showTabs) {
    trees = groupRolesByHierarchy(clerkRoles)
    treeReps = trees.map((tree) => {
      const sorted = [...tree].sort(
        (a, b) => (ROLE_PRECEDENCE[a] ?? Infinity) - (ROLE_PRECEDENCE[b] ?? Infinity),
      )
      return sorted[0]
    })
  }

  return (
    <nav
      aria-label="Role switcher"
      className="flex items-center gap-1.5 px-4 py-1 overflow-x-auto flex-shrink-0 max-w-4xl mx-auto w-full"
      data-testid="role-switcher"
    >
      {showTabs &&
        treeReps.map((rep, idx) => {
          const cfg = ROLE_BY_CLERK_ROLE[rep]
          if (!cfg) return null

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
              className="flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all border"
              style={{
                background: isActive ? 'var(--color-accent-glow)' : 'transparent',
                borderColor: isActive ? 'var(--color-accent)' : 'var(--color-glass-border)',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                transitionDuration: 'var(--transition-speed)',
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              <GlassTooltip label={cfg.label}>
                <Icon size={20} />
              </GlassTooltip>
            </Link>
          )
        })}

      <span
        className="ml-auto text-sm font-medium truncate text-primary"
        data-testid="role-switcher-name"
      >
        {displayName}
      </span>
    </nav>
  )
}
