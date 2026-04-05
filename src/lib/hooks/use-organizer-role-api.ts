import { api } from '@/lib/convex-generated'
import type { ClerkRole } from '@/lib/constants/roles'

export function useOrganizerRoleApi(role: ClerkRole) {
  switch (role) {
    case 'DiveCenter':
      return { mine: api.diveCenters.mine, update: api.diveCenters.update } as const
    case 'Agent':
      return { mine: api.agents.mine, update: api.agents.update } as const
    default:
      return null
  }
}
