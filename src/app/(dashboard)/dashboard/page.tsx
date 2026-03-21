'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { Spinner } from '@/components/common/spinner'

// Redirect landing — Clerk sends users here after sign-in.
// Reads user role from Convex and redirects to the role-scoped dashboard.
export default function DashboardRedirectPage() {
  const { user, isLoading } = useCurrentUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace('/sign-up')
      return
    }

    const roleConfig = ROLE_BY_CLERK_ROLE[user.role as ClerkRole]
    if (roleConfig) {
      router.replace(`/${roleConfig.key}/${user.slug}/dashboard`)
    } else {
      // No role set yet — send to sign-up wizard
      router.replace('/sign-up')
    }
  }, [user, isLoading, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner label="Loading dashboard…" />
    </div>
  )
}
