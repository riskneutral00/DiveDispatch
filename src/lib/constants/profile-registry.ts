import { ROLE_BY_KEY, type RoleKey } from './roles'

export interface ProfileConfig {
  label: string
  tabs: { id: string; label: string }[] | null
}

/** Tabs that only appear in the overlay — not on standalone profile pages. */
export const OVERLAY_ONLY_SECTIONS = new Set(['booking', 'resources', 'inventory'])

/** Derived from ROLE_BY_KEY — single source of truth is roles.ts profileTabs. */
export const PROFILE_REGISTRY: Record<string, ProfileConfig> = Object.fromEntries(
  Object.entries(ROLE_BY_KEY).map(([key, role]) => [
    key,
    { label: role.label, tabs: role.profileTabs },
  ]),
) as Record<RoleKey, ProfileConfig>
