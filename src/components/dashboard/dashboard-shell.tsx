'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ROLE_BY_CLERK_ROLE, type RoleKey } from '@/lib/constants/roles'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { BgSwitcher } from './bg-switcher'
import { HierarchySubBar } from './hierarchy-sub-bar'
import { MobileBottomNav } from './mobile-bottom-nav'
import { MobileTopNav } from './mobile-top-nav'
import { NotificationBell } from './notification-bell'
import { RoleTabBar } from './role-tab-bar'
import { ThemeSwitcher } from './theme-switcher'
import { UserMenu } from './user-menu'

interface DashboardShellProps {
  children: React.ReactNode
  roleSlug: RoleKey
  slug: string
}

export function DashboardShell({ children, roleSlug, slug }: DashboardShellProps) {
  const { user, isLoading } = useCurrentUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace('/role-select')
      return
    }
    if (user.slug !== slug) {
      const config = ROLE_BY_CLERK_ROLE[user.role as keyof typeof ROLE_BY_CLERK_ROLE]
      if (config) {
        router.replace(`${config.route}/${user.slug}/dashboard`)
      }
    }
  }, [user, isLoading, router, slug])

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span
          className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-hidden
        />
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
        <BgSwitcher />
        <ThemeSwitcher />
        <NotificationBell />
        <UserMenu roleSlug={roleSlug} slug={slug} />
      </header>

      {/* Mobile: sticky top header — visible on mobile only */}
      <MobileTopNav roleSlug={roleSlug} slug={slug} />

      {/* Hierarchy sub-bar — only renders when user has managed resources */}
      <HierarchySubBar slug={slug} />

      {/* Page content — pb-20 on mobile clears the fixed bottom nav */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">{children}</main>

      {/* Mobile: fixed bottom nav (thumb-zone navigation) */}
      <MobileBottomNav roleSlug={roleSlug} slug={slug} />
    </>
  )
}
