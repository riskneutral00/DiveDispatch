import { ROLE_BY_CLERK_ROLE, type ClerkRole } from './roles'

export type OrganizerSubStep = 'basic' | 'agency' | 'languages'

export interface OrganizerRoleFlags {
  supportsCoursePreferences: boolean
  locationModel: 'single' | 'multi'
  displayLabel: string
}

export const ORGANIZER_WIZARD_CONFIG: Partial<Record<ClerkRole, OrganizerSubStep[]>> = {
  DiveCenter: ['basic', 'agency', 'languages'],
  Agent: ['basic', 'agency'],
}

const ORGANIZER_ROLE_FLAGS: Partial<Record<ClerkRole, OrganizerRoleFlags>> = {
  DiveCenter: { supportsCoursePreferences: true, locationModel: 'single', displayLabel: 'dive center' },
  Agent: { supportsCoursePreferences: false, locationModel: 'multi', displayLabel: 'agent' },
}

export const ORGANIZER_WIZARD_ROLES = Object.keys(ORGANIZER_WIZARD_CONFIG) as ClerkRole[]

export function getOrganizerSteps(role: ClerkRole): OrganizerSubStep[] {
  return ORGANIZER_WIZARD_CONFIG[role] ?? ['basic']
}

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
