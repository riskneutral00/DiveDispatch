'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from 'convex/react'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/convex-generated'
import { type RoleKey, ROLE_BY_KEY } from '@/lib/constants/roles'
import { DASHBOARD_CONTENT_GUTTER_X } from '@/lib/constants/dashboard-layout'
import { cn } from '@/lib/utils/cn'
import { useDashboardSession } from '@/lib/hooks/use-dashboard-session'
import { useGuardedRedirect } from '@/lib/hooks/use-guarded-redirect'
import { useVenueSignupIntent, clearStoredVenueSignupIntent } from '@/lib/hooks/use-venue-signup-intent'
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
  const session = useDashboardSession()
  const { user, roles: myRoles, status } = session
  const clerkRole = ROLE_BY_KEY[roleSlug]?.clerkRole ?? 'DiveCenter'
  const profileCompletion = useQuery(api.users.getProfileCompletionForRole, { role: clerkRole })
  const roleComplete = myRoles?.some((r) => r.role === clerkRole && r.profileComplete === true) ?? false

  const [overlayOpen, setOverlayOpen] = useState(false)
  const [overlayTab, setOverlayTab] = useState<ProfileOverlayTab>('profile')
  const [overlaySection, setOverlaySection] = useState<string | undefined>(undefined)

  const openProfileOverlay = useCallback((tab: ProfileOverlayTab = 'profile', section?: string) => {
    setOverlayTab(tab)
    setOverlaySection(section)
    setOverlayOpen(true)
  }, [])

  const closeProfileOverlay = useCallback(() => {
    setOverlayOpen(false)
  }, [])

  const venueSignupIntent = useVenueSignupIntent()
  const venueRoleEntry = useMemo(
    () => myRoles?.find((r) => r.role === 'Venue') ?? null,
    [myRoles],
  )
  const venueRoleIncomplete = Boolean(venueRoleEntry && venueRoleEntry.profileComplete !== true)
  const autoOpenedRef = useRef(false)

  useEffect(() => {
    if (autoOpenedRef.current) return
    if (status !== 'ready') return
    if (!venueSignupIntent) return
    if (!venueRoleEntry) return
    autoOpenedRef.current = true
    if (!venueRoleIncomplete) {
      clearStoredVenueSignupIntent()
      return
    }
    setOverlayTab('role:venue')
    setOverlaySection('capabilities')
    setOverlayOpen(true)
  }, [status, venueSignupIntent, venueRoleEntry, venueRoleIncomplete])

  const redirectTo = useMemo<string | null>(() => {
    if (status === 'loading') return null
    if (status !== 'ready') return '/sign-up'
    if (session.validateSlug(slug) === 'mismatch' && session.slug) {
      return `/${session.slug}/${roleSlug}/dashboard`
    }
    if (!session.hasRole(clerkRole)) {
      if (session.defaultRoleKey && session.slug) {
        return `/${session.slug}/${session.defaultRoleKey}/dashboard`
      }
      return '/sign-up'
    }
    return null
  }, [status, session, slug, roleSlug, clerkRole])

  useGuardedRedirect({ to: redirectTo, enabled: redirectTo !== null })

  if (status !== 'ready' || !user || !myRoles) {
    return <FullPageSpinner label={t('loading')} />
  }

  return (
    <>
      <TopNav
        onOpenOverlay={openProfileOverlay}
        profileCompletion={profileCompletion}
        roleComplete={roleComplete}
        roleSlug={roleSlug}
      />

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
        initialSection={overlaySection}
        roleSlug={roleSlug}
        slug={slug}
      />
    </>
  )
}
