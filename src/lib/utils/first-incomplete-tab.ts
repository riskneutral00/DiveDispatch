import { ROLE_BY_KEY, type RoleKey } from '@/lib/constants/roles'
import { PROFILE_REQUIRED, SETTINGS_REQUIRED } from '@/lib/constants/required-fields'

export type ProfileOverlayTab = 'profile' | 'roles' | `role:${RoleKey}`

const GLOBAL_FIELDS: ReadonlySet<string> = new Set<string>([...PROFILE_REQUIRED, ...SETTINGS_REQUIRED])

export interface IncompleteTarget {
  tab: ProfileOverlayTab
  section?: string
}

export function firstIncompleteTab(
  roleKey: RoleKey,
  incomplete: readonly string[],
): IncompleteTarget {
  if (incomplete.length === 0) return { tab: 'profile' }
  if (incomplete.some((f) => GLOBAL_FIELDS.has(f))) return { tab: 'profile' }

  const tabs = ROLE_BY_KEY[roleKey]?.profileTabs ?? []
  const missing = new Set(incomplete)
  const hit = tabs.find((t) => t.fields?.some((f) => missing.has(f)))
  if (hit) return { tab: `role:${roleKey}`, section: hit.id }
  return { tab: `role:${roleKey}` }
}
