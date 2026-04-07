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
import { Tooltip } from '@/components/ui'
import { cn } from '@/lib/utils/cn'
import { hasMultipleHierarchies, groupRolesByHierarchy } from '@/lib/utils/role-hierarchy'
import { ROLE_PRECEDENCE } from '@/lib/utils/role'
import { useCurrentUser } from '@/lib/hooks/use-current-user'

interface RoleSwitcherProps {
  slug: string
  roleSlug: RoleKey
}

export function RoleSwitcher({ slug, roleSlug }: RoleSwitcherProps) {
  const roles = useQuery(api.userRoles.myRoles)
  const { user } = useCurrentUser()

  if (!roles) return null

  const clerkRoles = roles.map((r) => r.role as ClerkRole)
  const showTabs = hasMultipleHierarchies(clerkRoles)

  const displayName = user?.businessName ?? ROLE_BY_KEY[roleSlug]?.label ?? ''

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
      className="relative flex items-center gap-2 overflow-x-auto px-4 py-0.5 flex-shrink-0 max-w-4xl mx-auto w-full"
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
              className="flex items-center px-2.5 py-1.5 rounded-full text-label font-medium whitespace-nowrap flex-shrink-0 transition-all duration-theme border"
              style={{
                background: isActive ? 'var(--color-accent-glow)' : 'transparent',
                borderColor: isActive ? 'var(--color-accent)' : 'var(--color-glass-border)',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                transitionDuration: 'var(--transition-speed)',
              }}
              aria-label={cfg.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Tooltip label={cfg.label}>
                <Icon size={20} />
              </Tooltip>
            </Link>
          )
        })}

      {(showTabs || !roles || roles.length <= 1) && (
        <span
          className={cn(
            "text-center text-base font-semibold tracking-tight whitespace-nowrap text-primary",
            showTabs
              ? "absolute inset-x-0 pointer-events-none"
              : "mx-auto",
          )}
          data-testid="role-switcher-name"
        >
          {displayName}
        </span>
      )}
    </nav>
  )
}
