import { ROLE_BY_KEY, type RoleKey, type ProfileSectionId } from './roles'

export interface ProfileConfig {
  label: string
  tabs: { id: ProfileSectionId; label: string }[] | null
}

export const OVERLAY_ONLY_SECTIONS: Set<ProfileSectionId> = new Set(['booking', 'resources', 'gear'])

export const PROFILE_REGISTRY: Record<string, ProfileConfig> = Object.fromEntries(
  Object.entries(ROLE_BY_KEY).map(([key, role]) => [
    key,
    { label: role.label, tabs: role.profileTabs },
  ]),
) as Record<RoleKey, ProfileConfig>
