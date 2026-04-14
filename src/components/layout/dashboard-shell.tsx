'use client'

import { useCallback, useState } from 'react'
import { useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { api } from '@/lib/convex-generated'
import { type RoleKey, type ClerkRole, ROLE_BY_KEY, ROLE_BY_CLERK_ROLE } from '@/lib/constants/roles'
import { DASHBOARD_CONTENT_GUTTER_X } from '@/lib/constants/dashboard-layout'
import { deriveDefaultRole } from '@/lib/utils/role'
import { cn } from '@/lib/utils/cn'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { FullPageSpinner } from '@/components/ui/full-page-spinner'
import { ProfileOverlay, type ProfileOverlayTab } from '../profiles/profile-overlay'
import { HierarchySubBar } from './hierarchy-sub-bar'
import { TopNav } from './top-nav'

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
      <TopNav onOpenOverlay={openProfileOverlay} profileCompletion={profileCompletion} />

      <HierarchySubBar slug={slug} roleSlug={roleSlug} />

      <main
        className={cn(
          'dashboard-enter flex-1 min-w-0 pt-1 pb-8 sm:pt-2 md:pt-2 lg:pt-3',
          DASHBOARD_CONTENT_GUTTER_X,
        )}
      >
        {children}
      </main>

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
