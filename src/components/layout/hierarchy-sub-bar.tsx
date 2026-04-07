'use client'

import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { ROLE_BY_CLERK_ROLE, type ClerkRole, type RoleKey } from '@/lib/constants/roles'
import { Tooltip } from '@/components/ui'
import { ROLE_PRECEDENCE } from '@/lib/utils/role'

interface HierarchySubBarProps {
  slug: string
  roleSlug: RoleKey
  filterRoles?: Set<string>
  businessName?: string
}

export function HierarchySubBar({ slug, roleSlug, filterRoles, businessName }: HierarchySubBarProps) {
  const roles = useQuery(api.userRoles.myRoles)

  if (!roles || roles.length <= 1) return null

  const filtered = filterRoles
    ? roles.filter((r) => filterRoles.has(r.role))
    : roles

  if (filtered.length <= 1) return null

  const sorted = [...filtered].sort(
    (a, b) => (ROLE_PRECEDENCE[a.role] ?? Infinity) - (ROLE_PRECEDENCE[b.role] ?? Infinity),
  )

  const primaryIdx = 0

  return (
    <div className="relative flex items-center gap-2 overflow-x-auto px-4 py-0.5 flex-shrink-0 max-w-4xl mx-auto w-full">
      {sorted.map((role, idx) => {
        const cfg = ROLE_BY_CLERK_ROLE[role.role as ClerkRole]
        if (!cfg) return null

        const isActive = cfg.key === roleSlug
        const Icon = cfg.icon

        return (
          <span key={role.role} className="contents">
            {idx === primaryIdx + 1 && primaryIdx >= 0 && (
              <span
                className="h-5 w-px flex-shrink-0"
                style={{ background: 'var(--color-glass-border)' }}
              />
            )}
            <Link
              href={`/${slug}/${cfg.key}/dashboard`}
              className="flex items-center px-2.5 py-1.5 rounded-full text-label font-medium whitespace-nowrap flex-shrink-0 transition-all duration-theme"
              style={{
                background: isActive ? 'var(--color-accent-glow)' : 'transparent',
                border: `1px solid ${isActive ? 'var(--color-accent)' : 'var(--color-glass-border)'}`,
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
          </span>
        )
      })}

      {businessName && (
        <span
          className="hidden sm:block absolute inset-x-0 text-center text-base font-semibold tracking-tight whitespace-nowrap text-primary pointer-events-none"
          data-testid="hierarchy-bar-name"
        >
          {businessName}
        </span>
      )}
    </div>
  )
}
