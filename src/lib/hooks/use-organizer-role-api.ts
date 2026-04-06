import { api } from '@/lib/convex-generated'
import type { ClerkRole } from '@/lib/constants/roles'

/**
 * Resolves Convex API refs (mine/update/create) for organizer roles.
 * Returns null for roles without a dedicated Convex module yet
 * (Liveaboard, DiveResort, DiveHostel will be added as they ship).
 */
export function useOrganizerRoleApi(role: ClerkRole) {
  switch (role) {
    case 'DiveCenter':
      return {
        mine: api.diveCenters.mine,
        update: api.diveCenters.update,
        create: api.diveCenters.create,
      } as const
    case 'Agent':
      return {
        mine: api.agents.mine,
        update: api.agents.update,
        create: api.agents.create,
      } as const
    case 'DiveSite':
      return {
        mine: api.venues.mine,
        update: api.venues.update,
        create: api.venues.create,
      } as const
    default:
      return null
  }
}
