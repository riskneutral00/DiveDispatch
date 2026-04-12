'use client'

import Link from 'next/link'
import { useQuery } from 'convex/react'
import type { Doc } from '@/lib/convex-generated'
import { api } from '@/lib/convex-generated'
import { ROLE_BY_CLERK_ROLE, type ClerkRole, type RoleKey } from '@/lib/constants/roles'
import { Tooltip } from '@/components/ui'
import { DASHBOARD_CONTENT_GUTTER_X } from '@/lib/constants/dashboard-layout'
import { PILL_BASE } from '@/lib/constants/pill-shell'
import { cn } from '@/lib/utils/cn'

type UserRoleDoc = Doc<'userRoles'>

function sortByGrantOrder(rows: UserRoleDoc[]): UserRoleDoc[] {
  return [...rows].sort((a, b) => {
    const d = a.createdAt - b.createdAt
    if (d !== 0) return d
    return a._id < b._id ? -1 : a._id > b._id ? 1 : 0
  })
}

interface HierarchySubBarProps {
  slug: string
  roleSlug: RoleKey
}

export function HierarchySubBar({ slug, roleSlug }: HierarchySubBarProps) {
  const roles = useQuery(api.userRoles.myRoles)

  if (!roles || roles.length <= 1) return null

  const operators: UserRoleDoc[] = []
  const resources: UserRoleDoc[] = []
  for (const row of roles) {
    const cfg = ROLE_BY_CLERK_ROLE[row.role as ClerkRole]
    if (!cfg) continue
    if (cfg.isOrganizer) operators.push(row)
    else resources.push(row)
  }

  const sortedOps = sortByGrantOrder(operators)
  const sortedRes = sortByGrantOrder(resources)
  const showDivider = sortedOps.length > 0 && sortedRes.length > 0

  const segments: Array<{ kind: 'link'; doc: UserRoleDoc } | { kind: 'divider' }> = []
  for (const doc of sortedOps) {
    segments.push({ kind: 'link', doc })
  }
  if (showDivider) {
    segments.push({ kind: 'divider' })
  }
  for (const doc of sortedRes) {
    segments.push({ kind: 'link', doc })
  }

  const linkCount = segments.filter((s) => s.kind === 'link').length
  if (linkCount <= 1) return null

  return (
    <div className={cn(DASHBOARD_CONTENT_GUTTER_X, 'flex-shrink-0')}>
      <nav
        aria-label="Role navigation"
        className="relative flex items-center gap-2 overflow-x-auto py-0.5 max-w-4xl mx-auto w-full"
        data-testid="hierarchy-sub-bar"
      >
        {segments.map((seg, idx) => {
          if (seg.kind === 'divider') {
            return (
              <span
                key={`divider-${idx}`}
                data-testid="role-hierarchy-divider"
                className="h-5 w-px flex-shrink-0"
                style={{ background: 'var(--color-glass-border)' }}
                aria-hidden
              />
            )
          }
          const cfg = ROLE_BY_CLERK_ROLE[seg.doc.role as ClerkRole]
          if (!cfg) return null
          const isActive = cfg.key === roleSlug
          const Icon = cfg.icon
          return (
            <Link
              key={seg.doc._id}
              href={`/${slug}/${cfg.key}/dashboard`}
              className={cn(
                PILL_BASE,
                'glass-surface glass-surface-elevated role-pill flex flex-shrink-0 items-stretch justify-center',
                isActive ? 'role-pill--active' : 'role-pill--inactive',
              )}
              aria-label={cfg.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Tooltip
                label={cfg.label}
                className="!flex flex-1 items-center justify-center w-full min-h-0 min-w-0"
              >
                <Icon size={20} />
              </Tooltip>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
