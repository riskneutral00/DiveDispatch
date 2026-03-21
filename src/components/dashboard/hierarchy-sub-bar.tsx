'use client'

import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { ROLE_BY_CLERK_ROLE, ROLE_BY_KEY, type ClerkRole, type RoleKey } from '@/lib/constants/roles'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { GlassTooltip } from '@/components/glass'

interface HierarchySubBarProps {
  slug: string
  roleSlug: RoleKey
}

export function HierarchySubBar({ slug, roleSlug }: HierarchySubBarProps) {
  const { user } = useCurrentUser()
  const children = useQuery(api.stakeholderHierarchy.getManagedChildren, { parentSlug: slug })
  const parent = useQuery(api.stakeholderHierarchy.getManagedParent, { childSlug: slug })

  const isDCView = children && children.length > 0
  const isResourceView = !isDCView && parent != null

  // When on a resource dashboard, fetch siblings from the parent
  const siblings = useQuery(
    api.stakeholderHierarchy.getManagedChildren,
    isResourceView && parent ? { parentSlug: parent.parentSlug } : 'skip',
  )

  if (!isDCView && !isResourceView) return null

  // Parent DC config
  const dcCfg = isDCView
    ? ROLE_BY_KEY[roleSlug]
    : ROLE_BY_CLERK_ROLE[parent!.parentType as ClerkRole]
  const dcSlug = isDCView ? slug : parent!.parentSlug
  const dcName = isDCView ? (user?.businessName ?? slug) : parent!.parentName

  // Resource icons to show
  const items = isDCView ? children! : (siblings ?? [])

  if (!dcCfg) return null

  const DCIcon = dcCfg.icon

  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 overflow-x-auto flex-shrink-0 max-w-4xl mx-auto w-full"
    >
      {/* Parent DC icon — always first */}
      <Link
        href={`/${dcCfg.key}/${dcSlug}/dashboard`}
        className="flex items-center px-2.5 py-2 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all"
        style={{
          background: isDCView ? 'var(--color-accent-glow, rgba(0,191,255,0.15))' : 'transparent',
          border: `1px solid ${isDCView ? 'var(--color-accent)' : 'var(--color-glass-border)'}`,
          color: isDCView ? 'var(--color-accent)' : 'var(--color-text-secondary)',
          transitionDuration: 'var(--transition-speed)',
        }}
        aria-label={dcName}
      >
        <GlassTooltip label={dcName}>
          <DCIcon size={22} />
        </GlassTooltip>
      </Link>

      {/* Separator */}
      <span
        className="h-5 w-px flex-shrink-0"
        style={{ background: 'var(--color-glass-border)' }}
      />

      {/* Managed resource icons */}
      {items.map((child) => {
        const cfg = ROLE_BY_CLERK_ROLE[child.childType as ClerkRole]
        if (!cfg) return null
        const isActive = child.childSlug === slug
        return (
          <Link
            key={child.childSlug}
            href={`/${cfg.key}/${child.childSlug}/dashboard`}
            className="flex items-center px-2.5 py-2 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all"
            style={{
              background: isActive ? 'var(--color-accent-glow, rgba(0,191,255,0.15))' : 'transparent',
              border: `1px solid ${isActive ? 'var(--color-accent)' : 'var(--color-glass-border)'}`,
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              transitionDuration: 'var(--transition-speed)',
            }}
            aria-label={child.childName}
          >
            <GlassTooltip label={child.childName}>
              <cfg.icon size={22} />
            </GlassTooltip>
          </Link>
        )
      })}
    </div>
  )
}
