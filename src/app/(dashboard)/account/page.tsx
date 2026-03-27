'use client'

import { AccountForm } from '@/components/dashboard/account-form'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { deriveDefaultRole } from '../../../../convex/lib/rolePrecedence'
import { Spinner } from '@/components/common/spinner'
import { BgSwitcher } from '@/components/dashboard/bg-switcher'
import { ThemeSwitcher } from '@/components/dashboard/theme-switcher'
import { NotificationBell } from '@/components/dashboard/notification-bell'
import { UserMenu } from '@/components/dashboard/user-menu'
import { MobileTopNav } from '@/components/dashboard/mobile-top-nav'
import { MobileBottomNav } from '@/components/dashboard/mobile-bottom-nav'
import { useCurrentUser } from '@/lib/hooks/use-current-user'

export default function AccountPage() {
  const user = useQuery(api.users.me)
  const userRoles = useQuery(api.userRoles.myRoles)
  const { user: convexUser } = useCurrentUser()
  const router = useRouter()

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner label="Loading…" />
      </div>
    )
  }

  if (user === null) {
    router.replace('/sign-up')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner label="Redirecting…" />
      </div>
    )
  }

  const defaultRole = userRoles && userRoles.length > 0
    ? deriveDefaultRole(userRoles.map((r) => r.role))
    : null
  const roleConfig = defaultRole ? ROLE_BY_CLERK_ROLE[defaultRole as ClerkRole] : undefined

  const roleSlug = roleConfig?.key
  const slug = convexUser?.slug
  if (!roleSlug || !slug) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner label="Loading…" />
      </div>
    )
  }

  return (
    <>
      {/* Desktop top bar */}
      <header
        className="hidden md:flex items-center justify-between gap-2 px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-glass-border)' }}
      >
        <Link
          href={`/${slug}/${roleSlug}`}
          className="flex items-center gap-1 text-sm transition-opacity hover:opacity-70"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ChevronLeft size={16} />
          Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <BgSwitcher />
          <NotificationBell />
          <UserMenu roleSlug={roleSlug} slug={slug} />
        </div>
      </header>

      {/* Mobile top nav */}
      <MobileTopNav roleSlug={roleSlug} slug={slug} />

      {/* Page content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">
        <div className="w-full max-w-lg mx-auto">
          <div className="mb-6">
            <h1
              className="font-bold mb-1"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-page-title)' }}
            >
              Account
            </h1>
          </div>

          <AccountForm />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <MobileBottomNav roleSlug={roleSlug} slug={slug} />
    </>
  )
}
