import { ROLE_BY_CLERK_ROLE, type ClerkRole } from './roles'

/**
 * Sub-step identifiers for the organizer setup wizard.
 * Each organizer role maps to a sequence of these steps.
 */
export type OrganizerSubStep = 'basic' | 'agency' | 'languages'

/**
 * Config-driven flags that replace hardcoded role checks in wizard steps.
 * - supportsCoursePreferences: whether the languages step shows course durations and specialties
 * - locationModel: 'single' (top-level placeName/country) vs 'multi' (locations[] array)
 * - displayLabel: human-readable label for UI copy (e.g. "dive center", "agent")
 */
export interface OrganizerRoleFlags {
  supportsCoursePreferences: boolean
  locationModel: 'single' | 'multi'
  displayLabel: string
}

/**
 * Per-role step sequences for the organizer setup wizard.
 * Only organizer roles appear here; resource roles use their own profile forms.
 */
export const ORGANIZER_WIZARD_CONFIG: Partial<Record<ClerkRole, OrganizerSubStep[]>> = {
  DiveCenter: ['basic', 'agency', 'languages'],
  Agent: ['basic', 'agency'],
  Liveaboard: ['basic'],
  DiveResort: ['basic'],
  DiveHostel: ['basic'],
  DiveSite: ['basic'],
}

/** Per-role behavioral flags for wizard steps. */
const ORGANIZER_ROLE_FLAGS: Partial<Record<ClerkRole, OrganizerRoleFlags>> = {
  DiveCenter: { supportsCoursePreferences: true, locationModel: 'single', displayLabel: 'dive center' },
  Agent: { supportsCoursePreferences: false, locationModel: 'multi', displayLabel: 'agent' },
  Liveaboard: { supportsCoursePreferences: true, locationModel: 'single', displayLabel: 'liveaboard' },
  DiveResort: { supportsCoursePreferences: true, locationModel: 'single', displayLabel: 'dive resort' },
  DiveHostel: { supportsCoursePreferences: false, locationModel: 'single', displayLabel: 'dive hostel' },
  DiveSite: { supportsCoursePreferences: false, locationModel: 'single', displayLabel: 'dive site' },
}

/** All organizer roles that have wizard configs. */
export const ORGANIZER_WIZARD_ROLES = Object.keys(ORGANIZER_WIZARD_CONFIG) as ClerkRole[]

/** Get the step sequence for a given role, defaulting to ['basic']. */
export function getOrganizerSteps(role: ClerkRole): OrganizerSubStep[] {
  return ORGANIZER_WIZARD_CONFIG[role] ?? ['basic']
}

/** Get behavioral flags for a role, falling back to sensible defaults for unconfigured roles. */
export function getOrganizerRoleFlags(role: ClerkRole): OrganizerRoleFlags {
  const configured = ORGANIZER_ROLE_FLAGS[role]
  if (configured) return configured

  const roleConfig = ROLE_BY_CLERK_ROLE[role]
  return {
    supportsCoursePreferences: false,
    locationModel: 'single',
    displayLabel: roleConfig?.label.toLowerCase() ?? role.toLowerCase(),
  }
}
