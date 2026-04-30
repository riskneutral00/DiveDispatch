import type { ComponentType } from 'react'
import {
  PoolIcon,
  DiveSiteIcon,
  type RoleIconProps,
} from '@/lib/icons/role-icons'
import { VENUE_KINDS, type VenueKind } from '../../../convex/shared/venueTypes'
import {
  DISPLAY_OPERATOR_ROLES,
  DISPLAY_RESOURCE_ROLES,
  type ClerkRole,
  type RoleConfig,
} from './roles'

export type VenueSignupIntent = 'pool' | 'dive_site'

export const VENUE_SIGNUP_INTENT_STORAGE_KEY = 'dd-signup-venue-intent'

export interface SignupRoleTileConfig {
  tileKey: string
  clerkRole: ClerkRole
  label: string
  description: string
  icon: ComponentType<RoleIconProps>
  displayGroup: 'operator' | 'resource'
  venueKindHint?: VenueKind
  comingSoon?: boolean
}

const VENUE_KIND_TILES: Record<VenueKind, SignupRoleTileConfig> = {
  pool: {
    tileKey: 'pool',
    clerkRole: 'Venue',
    label: 'Pool',
    description: 'Operate a private pool used for confined-water training.',
    icon: PoolIcon,
    displayGroup: 'resource',
    venueKindHint: 'pool',
  },
  dive_site: {
    tileKey: 'dive-site',
    clerkRole: 'Venue',
    label: 'Dive Site',
    description:
      'Operate a private dive site — shore, reef, lake, river, quarry, or other open-water location.',
    icon: DiveSiteIcon,
    displayGroup: 'resource',
    venueKindHint: 'dive_site',
  },
}

export function getVenueKindTile(kind: VenueKind): SignupRoleTileConfig {
  return VENUE_KIND_TILES[kind]
}

function roleConfigToTile(
  role: RoleConfig,
  displayGroup: 'operator' | 'resource',
): SignupRoleTileConfig {
  return {
    tileKey: role.key,
    clerkRole: role.clerkRole,
    label: role.label,
    description: role.description,
    icon: role.icon,
    displayGroup,
  }
}

export function getSignupOperatorTiles(): SignupRoleTileConfig[] {
  return DISPLAY_OPERATOR_ROLES.map((r) => roleConfigToTile(r, 'operator'))
}

export function getSignupResourceTiles(): SignupRoleTileConfig[] {
  const nonVenue = DISPLAY_RESOURCE_ROLES
    .filter((r) => r.clerkRole !== 'Venue')
    .map((r) => roleConfigToTile(r, 'resource'))
  const venueTiles = VENUE_KINDS.map((k) => VENUE_KIND_TILES[k])
  return [...nonVenue, ...venueTiles]
}

export function collapseSignupTilesToRoles(
  tiles: SignupRoleTileConfig[],
): ClerkRole[] {
  const seen = new Set<ClerkRole>()
  const out: ClerkRole[] = []
  for (const t of tiles) {
    if (seen.has(t.clerkRole)) continue
    seen.add(t.clerkRole)
    out.push(t.clerkRole)
  }
  return out
}

export function deriveVenueSignupIntent(
  tiles: SignupRoleTileConfig[],
): VenueSignupIntent | null {
  const venueTiles = tiles.filter(
    (t) => t.clerkRole === 'Venue' && !t.comingSoon,
  )
  const kinds = new Set(
    venueTiles.map((t) => t.venueKindHint).filter((k): k is VenueKind => Boolean(k)),
  )
  if (kinds.size === 1) {
    const [only] = kinds
    if (only === 'pool' || only === 'dive_site') return only
  }
  return null
}
