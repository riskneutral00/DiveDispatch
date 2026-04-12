'use client'

import type { RoleKey } from '@/lib/constants/roles'
import { ProfileCompletionPill } from '../profiles/profile-completion-pill'
import type { ProfileOverlayTab } from '../profiles/profile-overlay'
import { BgSwitcher } from './bg-switcher'
import { ThemeSwitcher } from './theme-switcher'
import { NotificationBell } from '../notifications/notification-bell'
import { UserMenu } from './user-menu'

interface MobileTopNavProps {
  roleSlug: RoleKey
  slug: string
  /** Shown once on the leading edge; desktop uses the dashboard header instead. */
  businessName?: string | null
  onOpenOverlay?: (tab: ProfileOverlayTab) => void
  profileCompletion?: { percentage: number } | null
}

export function MobileTopNav({
  roleSlug,
  slug,
  businessName,
  onOpenOverlay,
  profileCompletion,
}: MobileTopNavProps) {
  return (
    <div
      className="md:hidden sticky top-0 z-[var(--z-sticky)] flex items-center gap-2 px-4 py-2 bg-surface-elevated glass-divider"
      style={{
        willChange: 'transform',
      }}
    >
      {businessName ? (
        <span className="flex-1 min-w-0 text-card-title font-semibold tracking-tight text-primary truncate">
          {businessName}
        </span>
      ) : (
        <div className="flex-1 min-w-0" />
      )}
      {profileCompletion && profileCompletion.percentage < 100 && onOpenOverlay && (
        <ProfileCompletionPill
          percentage={profileCompletion.percentage}
          onOpenOverlay={() => onOpenOverlay('profile')}
        />
      )}
      <ThemeSwitcher />
      <BgSwitcher />
      <NotificationBell />
      <UserMenu roleSlug={roleSlug} slug={slug} onOpenOverlay={onOpenOverlay} />
    </div>
  )
}
