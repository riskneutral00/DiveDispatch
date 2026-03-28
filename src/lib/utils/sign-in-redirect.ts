import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { deriveDefaultRole } from '@/lib/utils/role'

export type SignInRedirectResult =
  | { action: 'redirect'; path: string }
  | { action: 'none' }

/**
 * Pure function that determines where to redirect after sign-in.
 *
 * - User with roles: redirect to their default role dashboard
 * - Authenticated but no Convex user record: redirect to /sign-up
 * - Otherwise: no redirect (show sign-in form or loading state)
 */
export function resolveSignInRedirect(params: {
  isAuthenticated: boolean
  user: { slug: string } | null | undefined
  userRoles: { role: string }[] | undefined
}): SignInRedirectResult {
  const { isAuthenticated, user, userRoles } = params

  if (user && userRoles && userRoles.length > 0) {
    const defaultRole = deriveDefaultRole(userRoles.map((r) => r.role))
    const roleConfig = ROLE_BY_CLERK_ROLE[defaultRole as ClerkRole]
    return {
      action: 'redirect',
      path: roleConfig ? `/${user.slug}/${roleConfig.key}` : '/dashboard',
    }
  }

  if (isAuthenticated && user === null) {
    return { action: 'redirect', path: '/sign-up' }
  }

  return { action: 'none' }
}
