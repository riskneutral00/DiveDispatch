'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { useCurrentUser } from '@/lib/hooks/use-current-user'

// Redirect landing — Clerk sends users here after sign-in.
// Reads user role from Convex and redirects to the role-scoped dashboard.
export default function DashboardRedirectPage() {
  const { user, isLoading } = useCurrentUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace('/account')
      return
    }

    const roleConfig = ROLE_BY_CLERK_ROLE[user.role as ClerkRole]
    if (roleConfig) {
      router.replace(`/${roleConfig.key}/${user.slug}/dashboard`)
    } else {
      // No role set yet — send to onboarding wizard
      router.replace('/account')
    }
  }, [user, isLoading, router])

  return (
    <div
      className="min-h-screen flex items-center justify-center"
    >
      <div
        className="flex items-center gap-3"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <span
          className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden
        />
        <span className="text-sm">Loading dashboard…</span>
      </div>
    </div>
  )
}
