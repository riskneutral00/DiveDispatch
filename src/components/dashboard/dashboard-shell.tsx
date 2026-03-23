'use client'

import { useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { api } from '../../../convex/_generated/api'
import { ROLE_BY_CLERK_ROLE, type RoleKey } from '@/lib/constants/roles'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { Spinner } from '@/components/common/spinner'
import { RadialProgress } from '@/components/onboarding/radial-progress'
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
  const onboardingStatus = useQuery(api.users.getOnboardingStatus)
  const managedChildren = useQuery(
    api.stakeholderHierarchy.getManagedChildren,
    user ? { parentSlug: user.slug } : 'skip',
  )
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace('/sign-up')
      return
    }
    if (user.slug !== slug) {
      // Allow access if slug belongs to a managed child resource
      const isManagedChild = managedChildren?.some((c) => c.childSlug === slug)
      if (!isManagedChild) {
        const config = ROLE_BY_CLERK_ROLE[user.role as keyof typeof ROLE_BY_CLERK_ROLE]
        if (config) {
          router.replace(`/${user.slug}/${config.key}/dashboard`)
        }
      }
    }
  }, [user, isLoading, router, slug, managedChildren])

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--color-text-secondary)' }}>
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
        {onboardingStatus && onboardingStatus.percentage < 100 && (
          <RadialProgress
            percentage={onboardingStatus.percentage}
            incomplete={onboardingStatus.incomplete}
          />
        )}
        <ThemeSwitcher />
        <BgSwitcher />
        <NotificationBell />
        <UserMenu roleSlug={roleSlug} slug={slug} />
      </header>

      {/* Mobile: sticky top header — visible on mobile only */}
      <MobileTopNav roleSlug={roleSlug} slug={slug} />

      {/* Hierarchy sub-bar — DC icon + managed resources, or back nav on resource dashboards */}
      <HierarchySubBar slug={slug} roleSlug={roleSlug} />

      {/* Page content — pb-20 on mobile clears the fixed bottom nav */}
      <main className="dashboard-enter flex-1 p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">{children}</main>

      {/* Mobile: fixed bottom nav (thumb-zone navigation) */}
      <MobileBottomNav roleSlug={roleSlug} slug={slug} />
    </>
  )
}
