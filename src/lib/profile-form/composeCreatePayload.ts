import type { RoleConfig } from '@/lib/constants/roles'
import type { VenueKind } from '../../../convex/shared/venueTypes'

export interface ComposeContext {
  venueKind?: VenueKind
}

export function composeCreatePayload(
  config: RoleConfig,
  formInput: Record<string, unknown>,
  context: ComposeContext = {},
): Record<string, unknown> {
  if (config.clerkRole === 'Venue') {
    if (!context.venueKind) {
      throw new Error('VENUE_KIND_REQUIRED')
    }
    return {
      ...formInput,
      kind: context.venueKind,
      features: [],
    }
  }

  const extras = config.contact?.payloadExtras
  const createDefaults = extras && 'createDefaults' in extras ? extras.createDefaults : undefined
  return createDefaults ? { ...formInput, ...createDefaults } : { ...formInput }
}

export function needsCreateOverride(config: RoleConfig): boolean {
  if (config.clerkRole === 'Venue') return true
  const extras = config.contact?.payloadExtras
  return Boolean(extras && 'createDefaults' in extras)
}
