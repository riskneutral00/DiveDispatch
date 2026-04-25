'use client'

import { useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import type { ClerkRole } from '@/lib/constants/roles'
import { buildParentContactDefaults } from './create-override'

export type InheritedContactDefaults = Record<string, unknown>

export function useInheritedContactDefaults(
  excludeRole: ClerkRole,
  me: Record<string, unknown> | null | undefined,
): InheritedContactDefaults {
  const inherited = useQuery(api.users.inheritedContactDefaults, { excludeRole })

  return useMemo(() => {
    const fallback = buildParentContactDefaults(me)
    if (!inherited) return fallback
    return {
      ...fallback,
      ...(inherited.address !== undefined && { address: inherited.address }),
      ...(inherited.placeId !== undefined && { placeId: inherited.placeId }),
      lat: inherited.lat ?? fallback.lat,
      lng: inherited.lng ?? fallback.lng,
      email: inherited.email || (fallback.email as string),
      phone: inherited.phone || (fallback.phone as string),
    }
  }, [inherited, me])
}
