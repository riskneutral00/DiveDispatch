'use client'

import type { RoleKey } from '@/lib/constants/roles'
import { ProfileCompletionPill } from './profile-completion-pill'
import type { ProfileOverlayTab } from './profile-overlay'
import { BgSwitcher } from './bg-switcher'
import { ThemeSwitcher } from './theme-switcher'
import { NotificationBell } from './notification-bell'
import { UserMenu } from './user-menu'

interface MobileTopNavProps {
  roleSlug: RoleKey
  slug: string
  onOpenOverlay?: (tab: ProfileOverlayTab) => void
  profileCompletion?: { percentage: number } | null
}

export function MobileTopNav({ roleSlug, slug, onOpenOverlay, profileCompletion }: MobileTopNavProps) {
  return (
    <div
      className="md:hidden sticky top-0 z-20 flex items-center justify-end gap-2 px-4 py-2"
      style={{
        background: 'var(--color-glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderBottom: '1px solid var(--color-glass-border)',
        willChange: 'transform',
      }}
    >
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
