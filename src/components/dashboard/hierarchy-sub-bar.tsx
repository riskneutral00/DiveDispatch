'use client'

import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'

interface HierarchySubBarProps {
  slug: string
}

export function HierarchySubBar({ slug }: HierarchySubBarProps) {
  const children = useQuery(api.stakeholderHierarchy.getManagedChildren, { parentSlug: slug })

  if (!children || children.length === 0) return null

  return (
    <div
      className="flex items-center gap-1 px-4 py-1.5 overflow-x-auto flex-shrink-0 max-w-4xl mx-auto w-full"
    >
      <span
        className="text-xs mr-1 flex-shrink-0"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Managed:
      </span>
      {children.map((child) => {
        const cfg = ROLE_BY_CLERK_ROLE[child.childType as ClerkRole]
        if (!cfg) return null
        return (
          <Link
            key={child.childSlug}
            href={`/${cfg.key}/${child.childSlug}/dashboard`}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-glass-border)',
              color: 'var(--color-text-secondary)',
              transitionDuration: 'var(--transition-speed)',
            }}
          >
            <cfg.icon size={11} />
            {child.childSlug}
          </Link>
        )
      })}
    </div>
  )
}
