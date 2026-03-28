import type { ClerkRole } from './roles'

/**
 * Sub-step identifiers for the organizer setup wizard.
 * Each organizer role maps to a sequence of these steps.
 */
export type OrganizerSubStep = 'basic' | 'agency' | 'languages'

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

/** All organizer roles that have wizard configs. */
export const ORGANIZER_WIZARD_ROLES = Object.keys(ORGANIZER_WIZARD_CONFIG) as ClerkRole[]

/** Get the step sequence for a given role, defaulting to ['basic']. */
export function getOrganizerSteps(role: ClerkRole): OrganizerSubStep[] {
  return ORGANIZER_WIZARD_CONFIG[role] ?? ['basic']
}
