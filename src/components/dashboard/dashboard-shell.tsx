'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ROLE_BY_CLERK_ROLE, type RoleKey } from '@/lib/constants/roles'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { MobileBottomNav } from './mobile-bottom-nav'
import { MobileTopNav } from './mobile-top-nav'
import { NavSidebar } from './nav-sidebar'

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
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--body-bg)' }}
      >
        <span
          className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-hidden
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Background stack */}
      <div className="bg-image" />
      <div className="bg-overlay" />

      {/* App shell */}
      <div className="app-shell flex min-h-screen">
        {/* Main area */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Mobile: sticky top header (branding + identity) */}
          <MobileTopNav roleSlug={roleSlug} slug={slug} />

          {/* Page content — pb-20 on mobile clears the fixed bottom nav */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">{children}</main>

          {/* Mobile: fixed bottom nav (thumb-zone navigation) */}
          <MobileBottomNav roleSlug={roleSlug} slug={slug} />
        </div>

        {/* Desktop sidebar — right side, hidden below md */}
        <aside className="hidden md:flex flex-col w-64 flex-shrink-0 h-screen sticky top-0">
          <NavSidebar roleSlug={roleSlug} slug={slug} />
        </aside>
      </div>
    </div>
  )
}
