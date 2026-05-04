'use client'

import { useMutation } from 'convex/react'
import type { FunctionReference } from 'convex/server'
import { ROLE_BY_CLERK_ROLE, ROLE_BY_KEY, type ClerkRole, type RoleKey } from '@/lib/constants/roles'

export interface EntityMutationApi {
  create: (args: Record<string, unknown>) => Promise<unknown>
  update: (args: Record<string, unknown>) => Promise<unknown>
  mine: FunctionReference<'query'>
  idArg: 'entityId' | 'venueId' | 'compressorId' | null
}

export function useEntityMutation(role: RoleKey | ClerkRole): EntityMutationApi {
  const config = role in ROLE_BY_KEY
    ? ROLE_BY_KEY[role as RoleKey]
    : ROLE_BY_CLERK_ROLE[role as ClerkRole]
  const createMut = useMutation(config.api.create)
  const updateMut = useMutation(config.api.update)
  return {
    create: (args: Record<string, unknown>) => createMut(args as never),
    update: (args: Record<string, unknown>) => updateMut(args as never),
    mine: config.api.mine,
    idArg: config.api.idArg,
  }
}
