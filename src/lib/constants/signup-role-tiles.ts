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

export type VenueSignupIntent = 'pool' | 'dive_site' | 'multi'

export const VENUE_SIGNUP_INTENT_STORAGE_KEY = 'dd-signup-venue-intent'

export interface SignupRoleTileConfig {
  tileKey: string
  clerkRole: ClerkRole
  label: string
  description: string
  icon: ComponentType<RoleIconProps>
  displayGroup: 'operator' | 'resource'
  venueKindHint?: VenueKind
}

interface VenueKindDisplayMeta {
  tileKey: string
  label: string
  description: string
  icon: ComponentType<RoleIconProps>
}

const VENUE_KIND_DISPLAY: Record<VenueKind, VenueKindDisplayMeta> = {
  pool: {
    tileKey: 'pool',
    label: 'Pool',
    description: 'Operate a private pool used for confined-water training.',
    icon: PoolIcon,
  },
  dive_site: {
    tileKey: 'dive-site',
    label: 'Dive Site',
    description:
      'Operate a private dive site — shore, reef, lake, river, quarry, or other open-water location.',
    icon: DiveSiteIcon,
  },
}

function venueKindToTile(kind: VenueKind): SignupRoleTileConfig {
  const meta = VENUE_KIND_DISPLAY[kind]
  return {
    tileKey: meta.tileKey,
    clerkRole: 'Venue',
    label: meta.label,
    description: meta.description,
    icon: meta.icon,
    displayGroup: 'resource',
    venueKindHint: kind,
  }
}

function roleConfigToResourceTile(role: RoleConfig): SignupRoleTileConfig {
  return {
    tileKey: role.key,
    clerkRole: role.clerkRole,
    label: role.label,
    description: role.description,
    icon: role.icon,
    displayGroup: 'resource',
  }
}

function roleConfigToOperatorTile(role: RoleConfig): SignupRoleTileConfig {
  return {
    tileKey: role.key,
    clerkRole: role.clerkRole,
    label: role.label,
    description: role.description,
    icon: role.icon,
    displayGroup: 'operator',
  }
}

export function getSignupOperatorTiles(): SignupRoleTileConfig[] {
  return DISPLAY_OPERATOR_ROLES.map(roleConfigToOperatorTile)
}

export function getSignupResourceTiles(): SignupRoleTileConfig[] {
  const nonVenue = DISPLAY_RESOURCE_ROLES.filter((r) => r.clerkRole !== 'Venue').map(
    roleConfigToResourceTile,
  )
  const venueTiles = VENUE_KINDS.map(venueKindToTile)
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
  const kinds = tiles
    .filter((t) => t.clerkRole === 'Venue' && t.venueKindHint)
    .map((t) => t.venueKindHint as VenueKind)
  if (kinds.length === 0) return null
  if (kinds.length > 1) return 'multi'
  return kinds[0]
}

export function tilesIncludeRole(
  tiles: SignupRoleTileConfig[],
  clerkRole: ClerkRole,
): boolean {
  return tiles.some((t) => t.clerkRole === clerkRole)
}

