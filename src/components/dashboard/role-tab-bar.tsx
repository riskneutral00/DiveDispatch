'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import {
  ROLE_BY_CLERK_ROLE,
  ROLE_BY_KEY,
  type ClerkRole,
  type RoleKey,
} from '@/lib/constants/roles'
import { useCurrentUser } from '@/lib/hooks/use-current-user'

interface RoleTabBarProps {
  roleSlug: RoleKey
  slug: string
}

export function RoleTabBar({ roleSlug, slug }: RoleTabBarProps) {
  const { user } = useCurrentUser()
  if (!user) return null

  const allRoles: ClerkRole[] = [
    user.role as ClerkRole,
    ...((user.additionalRoles ?? []) as ClerkRole[]),
  ]
  const uniqueRoles = [...new Set(allRoles)]

  // Only show for multi-role users
  if (uniqueRoles.length < 2) return null

  const activeRoleConfig = ROLE_BY_KEY[roleSlug]
  const isOrganizer = activeRoleConfig?.isOrganizer ?? false

  return (
    <div
      className="flex items-center gap-1 px-4 py-2 overflow-x-auto flex-shrink-0 max-w-4xl mx-auto w-full"
    >
      {uniqueRoles.map((clerkRole) => {
        const cfg = ROLE_BY_CLERK_ROLE[clerkRole]
        if (!cfg) return null
        const isActive = cfg.key === roleSlug
        return (
          <Link
            key={clerkRole}
            href={`/${cfg.key}/${slug}/dashboard`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all"
            style={
              isActive
                ? {
                    background: 'var(--color-primary)',
                    color: 'var(--color-text-on-primary)',
                    transitionDuration: 'var(--transition-speed)',
                  }
                : {
                    background: 'var(--color-glass-bg)',
                    border: '1px solid var(--color-glass-border)',
                    color: 'var(--color-text-secondary)',
                    transitionDuration: 'var(--transition-speed)',
                  }
            }
            aria-current={isActive ? 'page' : undefined}
          >
            <cfg.icon size={12} />
            {cfg.label}
          </Link>
        )
      })}

      {isOrganizer && (
        <Link
          href="/booking/new"
          className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all"
          style={{
            background: 'var(--color-primary)',
            color: 'var(--color-text-on-primary)',
            transitionDuration: 'var(--transition-speed)',
          }}
        >
          <Plus size={12} />
          Booking
        </Link>
      )}
    </div>
  )
}
