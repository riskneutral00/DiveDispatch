/**
 * Pure helper: builds the dynamic onboarding step list based on user's roles.
 * Extracted for testability — no React dependencies.
 */

import { ROLES } from '@/lib/constants/roles'

export interface StepDef {
  key: string
  label: string
}

/** Get the display label for a ClerkRole string. */
export function roleLabelForClerkRole(clerkRole: string): string {
  const config = ROLES.find((r) => r.clerkRole === clerkRole)
  return config?.label ?? clerkRole
}

/** Determine if any role in the set is an operator role. */
export function hasOperatorRole(roleNames: string[]): boolean {
  return roleNames.some(
    (r) => ROLES.find((rc) => rc.clerkRole === r)?.displayGroup === 'operator',
  )
}

/**
 * Build the dynamic step list based on the user's roles.
 * Pattern: Business Info > [Role 1 Profile] > [Role 2 Profile] > ... > Preferences > Review
 * - Business Info only for operator roles
 * - Preferences only for operator roles
 * - Profile step labels show role name when multi-role, generic "Profile" when single-role
 */
export function buildOnboardingSteps(roleNames: string[]): StepDef[] {
  const isOperator = hasOperatorRole(roleNames)
  const steps: StepDef[] = []

  if (isOperator) {
    steps.push({ key: 'business-info', label: 'Business' })
  }

  for (const roleName of roleNames) {
    const label = roleLabelForClerkRole(roleName)
    steps.push({
      key: `profile:${roleName}`,
      label: roleNames.length > 1 ? label : 'Profile',
    })
  }

  if (isOperator) {
    steps.push({ key: 'preferences', label: 'Preferences' })
  }

  steps.push({ key: 'review', label: 'Review' })

  return steps
}
