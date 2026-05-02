import type { RoleKey } from '@/lib/constants/roles'
import type { SessionStatus } from '@/lib/hooks/use-session-identity'

export type AuthDestinationStatus = SessionStatus | 'no-role'

export interface ResolveDestinationInput {
  status: AuthDestinationStatus
  slug: string | null
  defaultRoleKey: RoleKey | null
}

export function resolveAuthDestination({
  status,
  slug,
  defaultRoleKey,
}: ResolveDestinationInput): string | null {
  switch (status) {
    case 'loading':
      return null
    case 'unauthenticated':
      return '/sign-in'
    case 'unprovisioned':
    case 'no-role':
      return '/sign-up'
    case 'ready':
      if (slug && defaultRoleKey) return `/${slug}/${defaultRoleKey}/dashboard`
      return '/sign-up'
  }
}
