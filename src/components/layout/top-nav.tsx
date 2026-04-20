'use client'

import { useClerk, useUser } from '@clerk/nextjs'
import { useQuery } from 'convex/react'
import { LogOut, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components'
import { api } from '@/lib/convex-generated'
import { ROLE_BY_CLERK_ROLE, type ClerkRole, type RoleKey } from '@/lib/constants/roles'
import { ICON_BUTTON_SIZE } from '@/lib/constants/button-sizes'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { firstIncompleteTab } from '@/lib/utils/first-incomplete-tab'
import { ProfileCompletionPill } from '../profiles/profile-completion-pill'
import { ProfileStartBanner } from '../profiles/profile-start-banner'
import type { ProfileOverlayTab } from '../profiles/profile-overlay'
import { NotificationBell } from '../notifications/notification-bell'
import { ThemeSwitcher } from './theme-switcher'
import { BgSwitcher } from './bg-switcher'

interface TopNavProps {
  onOpenOverlay: (tab: ProfileOverlayTab, section?: string) => void
  profileCompletion?: { percentage: number; incomplete: string[]; kind?: 'not_started' | 'partial' | 'complete' } | null
  roleSlug: RoleKey
}

const MENU_ITEM_CLASS =
  'flex items-center gap-2 px-3 py-2 text-body cursor-pointer text-secondary outline-none data-[focused]:bg-[color-mix(in_oklab,var(--color-primary)_10%,transparent)]'

export function TopNav({ onOpenOverlay, profileCompletion, roleSlug }: TopNavProps) {
  const tNav = useTranslations('nav')
  const { user: clerkUser } = useUser()
  const { user: convexUser } = useCurrentUser()
  const { signOut } = useClerk()
  const userRoles = useQuery(api.userRoles.myRoles)
  const roleConfigs = (userRoles ?? [])
    .map((r) => ROLE_BY_CLERK_ROLE[r.role as ClerkRole])
    .filter(Boolean)

  const displayName =
    convexUser?.firstName || clerkUser?.fullName || clerkUser?.username || '…'
  const initials = displayName.slice(0, 2).toUpperCase()
  const subLabel = convexUser?.nickname ?? null

  function handleSignOut() {
    document.cookie = 'dd-locale=; path=/; max-age=0'
    signOut({ redirectUrl: '/' })
  }

  function handleAction(key: React.Key) {
    if (key === 'profile') {
      onOpenOverlay('profile')
    } else if (key === 'signout') {
      handleSignOut()
    } else if (typeof key === 'string' && key.startsWith('role:')) {
      onOpenOverlay(key as ProfileOverlayTab)
    }
  }

  return (
    <div className="sticky top-0 z-[var(--z-sticky)] flex items-center justify-end gap-2 px-4 py-2 bg-surface-elevated glass-divider">
      {profileCompletion && profileCompletion.kind === 'not_started' && (
        <ProfileStartBanner
          roleSlug={roleSlug}
          onOpenOverlay={() => {
            const { tab, section } = firstIncompleteTab(roleSlug, profileCompletion.incomplete)
            onOpenOverlay(tab, section)
          }}
        />
      )}
      {profileCompletion && profileCompletion.kind !== 'not_started' && profileCompletion.percentage < 100 && (
        <ProfileCompletionPill
          percentage={profileCompletion.percentage}
          onOpenOverlay={() => {
            const { tab, section } = firstIncompleteTab(roleSlug, profileCompletion.incomplete)
            onOpenOverlay(tab, section)
          }}
        />
      )}
      <ThemeSwitcher />
      <BgSwitcher />
      <NotificationBell />

      <MenuTrigger>
        {/* design-ok: react-aria Button required as MenuTrigger anchor */}
        <Button
          aria-label={tNav('userMenu')}
          className={`${ICON_BUTTON_SIZE} rounded-full flex items-center justify-center text-label font-bold flex-shrink-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-glow)] bg-primary-solid text-on-primary`}
        >
          {initials}
        </Button>
        <Popover
          placement="bottom end"
          offset={4}
          className="z-[var(--z-dropdown)] min-w-[200px] glass-elevated glass-overlay-blur outline-none bg-surface-elevated border border-glass-border rounded-[var(--border-radius)]"
        >
          <div className="px-3 py-2 glass-divider">
            <p className="text-body font-medium truncate leading-tight text-primary">
              {displayName}
            </p>
            {subLabel && (
              <p className="text-label truncate leading-tight mt-0.5 text-secondary">
                {subLabel}
              </p>
            )}
          </div>
          <Menu className="py-1 outline-none" onAction={handleAction}>
            <MenuItem id="profile" className={MENU_ITEM_CLASS}>
              <User size={14} />
              {tNav('profile')}
            </MenuItem>
            {roleConfigs.map((role) => {
              const Icon = role.icon
              return (
                <MenuItem
                  key={role.key}
                  id={`role:${role.key}`}
                  className={MENU_ITEM_CLASS}
                >
                  <Icon size={14} />
                  {role.label}
                </MenuItem>
              )
            })}
            <MenuItem
              id="signout"
              className={`${MENU_ITEM_CLASS} border-t border-glass-border mt-1 pt-2`}
            >
              <LogOut size={14} />
              {tNav('signOut')}
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    </div>
  )
}
