import { ROLE_BY_KEY, type RoleKey } from './roles'

export interface ProfileConfig {
  label: string
  tabs: { id: string; label: string }[] | null
}

export const OVERLAY_ONLY_SECTIONS = new Set(['booking', 'resources', 'gear'])

export const PROFILE_REGISTRY: Record<string, ProfileConfig> = Object.fromEntries(
  Object.entries(ROLE_BY_KEY).map(([key, role]) => [
    key,
    { label: role.label, tabs: role.profileTabs },
  ]),
) as Record<RoleKey, ProfileConfig>
