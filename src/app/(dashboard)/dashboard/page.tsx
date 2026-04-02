'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { Spinner } from '@/components/ui/spinner'
import { deriveDefaultRole } from '@/lib/utils/role'

// Redirect landing — Clerk sends users here after sign-in.
// Reads user roles from Convex and redirects to the role-scoped dashboard.
export default function DashboardRedirectPage() {
  const t = useTranslations('common')
  const { user, isLoading } = useCurrentUser()
  const userRoles = useQuery(api.userRoles.myRoles)
  const router = useRouter()

  useEffect(() => {
    if (isLoading || userRoles === undefined) return
    if (!user) {
      router.replace('/sign-up')
      return
    }

    if (userRoles.length > 0) {
      const defaultRole = deriveDefaultRole(userRoles.map((r) => r.role))
      const roleConfig = ROLE_BY_CLERK_ROLE[defaultRole as ClerkRole]
      if (roleConfig) {
        router.replace(`/${user.slug}/${roleConfig.key}`)
        return
      }
    }
    // No roles set yet — send to sign-up wizard
    router.replace('/sign-up')
  }, [user, userRoles, isLoading, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner label={t('loadingDashboard')} />
    </div>
  )
}
