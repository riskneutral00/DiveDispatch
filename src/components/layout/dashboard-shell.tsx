'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { api } from '@/lib/convex-generated'
import { type RoleKey, type ClerkRole, ROLE_BY_KEY, ROLE_BY_CLERK_ROLE } from '@/lib/constants/roles'
import { hasMultipleHierarchies, groupRolesByHierarchy } from '@/lib/utils/role-hierarchy'
import { deriveDefaultRole } from '@/lib/utils/role'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { FullPageSpinner } from '@/components/ui/full-page-spinner'
import { ProfileCompletionPill } from '../profiles/profile-completion-pill'
import { ProfileOverlay, type ProfileOverlayTab } from '../profiles/profile-overlay'
import { BgSwitcher } from './bg-switcher'
import { ThemeSwitcher } from './theme-switcher'
import { HierarchySubBar } from './hierarchy-sub-bar'
import { RoleSwitcher } from './role-switcher'
import { MobileBottomNav } from './mobile-bottom-nav'
import { MobileTopNav } from './mobile-top-nav'
import { NotificationBell } from '../notifications/notification-bell'
import { UserMenu } from './user-menu'

interface DashboardShellProps {
  children: React.ReactNode
  roleSlug: RoleKey
  slug: string
}

export function DashboardShell({ children, roleSlug, slug }: DashboardShellProps) {
  const t = useTranslations('common')
  const { user, isLoading } = useCurrentUser()
  const clerkRole = ROLE_BY_KEY[roleSlug]?.clerkRole ?? 'DiveCenter'
  const profileCompletion = useQuery(api.users.getProfileCompletionForRole, { role: clerkRole })
  const myRoles = useQuery(api.userRoles.myRoles)
  const router = useRouter()

  const activeTreeFilter = useMemo(() => {
    if (!myRoles) return undefined
    const clerkRoles = myRoles.map((r) => r.role as ClerkRole)
    if (!hasMultipleHierarchies(clerkRoles)) return undefined
    const trees = groupRolesByHierarchy(clerkRoles)
    const activeTree = trees.find((tree) =>
      tree.some((r) => {
        const cfg = ROLE_BY_CLERK_ROLE[r]
        return cfg && cfg.key === roleSlug
      }),
    )
    return activeTree ? new Set(activeTree as string[]) : undefined
  }, [myRoles, roleSlug])

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
    if (myRoles === undefined) return // user exists but roles still loading
    if (user.slug !== slug) {
      router.replace(`/${user.slug}/${roleSlug}/dashboard`)
      return
    }
    const holdsRole = myRoles.some((r) => r.role === clerkRole)
    if (!holdsRole) {
      const heldRoles = myRoles.map((r) => r.role)
      if (heldRoles.length > 0) {
        const defaultRole = deriveDefaultRole(heldRoles)
        const defaultCfg = ROLE_BY_CLERK_ROLE[defaultRole as ClerkRole]
        if (defaultCfg) {
          router.replace(`/${user.slug}/${defaultCfg.key}/dashboard`)
          return
        }
      }
      router.replace('/sign-up')
    }
  }, [user, isLoading, myRoles, router, slug, roleSlug, clerkRole])

  if (isLoading || !user || myRoles === undefined) {
    return <FullPageSpinner label={t('loading')} />
  }

  return (
    <>
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

      <MobileTopNav
        roleSlug={roleSlug}
        slug={slug}
        onOpenOverlay={openProfileOverlay}
        profileCompletion={profileCompletion}
      />

      <RoleSwitcher slug={slug} roleSlug={roleSlug} />

      <HierarchySubBar
        slug={slug}
        roleSlug={roleSlug}
        filterRoles={activeTreeFilter}
        businessName={activeTreeFilter ? undefined : (user.businessName ?? undefined)}
      />

      <main className="dashboard-enter flex-1 pt-1 px-4 pb-20 sm:pt-2 sm:px-6 lg:pt-3 lg:px-8 md:pb-8">{children}</main>

      <MobileBottomNav roleSlug={roleSlug} slug={slug} />

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
