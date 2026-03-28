'use client'

import { useCallback, useState } from 'react'
import { useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { api } from '../../../convex/_generated/api'
import { type RoleKey, ROLE_BY_KEY } from '@/lib/constants/roles'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { Spinner } from '@/components/common/spinner'
import { ProfileCompletionPill } from './profile-completion-pill'
import { ProfileOverlay, type ProfileOverlayTab } from './profile-overlay'
import { BgSwitcher } from './bg-switcher'
import { ThemeSwitcher } from './theme-switcher'
import { HierarchySubBar } from './hierarchy-sub-bar'
import { MobileBottomNav } from './mobile-bottom-nav'
import { MobileTopNav } from './mobile-top-nav'
import { NotificationBell } from './notification-bell'
import { UserMenu } from './user-menu'

interface DashboardShellProps {
  children: React.ReactNode
  roleSlug: RoleKey
  slug: string
}

export function DashboardShell({ children, roleSlug, slug }: DashboardShellProps) {
  const { user, isLoading } = useCurrentUser()
  const clerkRole = ROLE_BY_KEY[roleSlug]?.clerkRole ?? 'DiveCenter'
  const profileCompletion = useQuery(api.users.getProfileCompletionForRole, { role: clerkRole })
  const router = useRouter()

  // ── Profile overlay state ──────────────────────────────────────────────────
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [overlayTab, setOverlayTab] = useState<ProfileOverlayTab>('profile')

  const openProfileOverlay = useCallback((tab: ProfileOverlayTab = 'profile') => {
    setOverlayTab(tab)
    setOverlayOpen(true)
  }, [])

  const closeProfileOverlay = useCallback(() => {
    setOverlayOpen(false)
  }, [])

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace('/sign-up')
      return
    }
    if (user.slug !== slug) {
      // Post-unification: all roles share the user's slug.
      // If the URL slug doesn't match, redirect to the user's primary dashboard.
      router.replace(`/${user.slug}/${roleSlug}/dashboard`)
    }
  }, [user, isLoading, router, slug, roleSlug])

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-secondary">
        <Spinner />
      </div>
    )
  }

  return (
    <>
      {/* Desktop top bar — right-aligned icon group, hidden on mobile */}
      <header
        className="hidden md:flex items-center justify-end gap-2 px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-glass-border)' }}
      >
        {profileCompletion && profileCompletion.percentage < 100 && (
          <ProfileCompletionPill
            percentage={profileCompletion.percentage}
            onOpenOverlay={() => openProfileOverlay('profile')}
          />
        )}
        <ThemeSwitcher />
        <BgSwitcher />
        <NotificationBell />
        <UserMenu
          roleSlug={roleSlug}
          slug={slug}
          onOpenOverlay={openProfileOverlay}
        />
      </header>

      {/* Mobile: sticky top header — visible on mobile only */}
      <MobileTopNav
        roleSlug={roleSlug}
        slug={slug}
        onOpenOverlay={openProfileOverlay}
        profileCompletion={profileCompletion}
      />

      {/* Role switcher — shows all user roles as icon pills */}
      <HierarchySubBar slug={slug} roleSlug={roleSlug} />

      {/* Page content — pb-20 on mobile clears the fixed bottom nav */}
      <main className="dashboard-enter flex-1 p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">{children}</main>

      {/* Mobile: fixed bottom nav (thumb-zone navigation) */}
      <MobileBottomNav roleSlug={roleSlug} slug={slug} />

      {/* Unified profile/preferences/account overlay */}
      <ProfileOverlay
        open={overlayOpen}
        onClose={closeProfileOverlay}
        initialTab={overlayTab}
        roleSlug={roleSlug}
        slug={slug}
      />
    </>
  )
}
