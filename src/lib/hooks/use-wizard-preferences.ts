'use client'

import { useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import type { Doc } from '@/lib/convex-generated'
import { useSessionIdentity } from './use-session-identity'

export type WizardPreferencesDoc = Doc<'stakeholderPreferences'> | null | undefined

export interface ResolveWizardPreferencesInputs {
  targetOperatorSlug: string | null | undefined
  userRoles: { role: string }[] | undefined
  minePrefs: Doc<'stakeholderPreferences'> | null | undefined
  fromTarget: Doc<'stakeholderPreferences'> | null | undefined
  fromAgentPreferred: Doc<'stakeholderPreferences'> | null | undefined
}

export interface ResolveWizardPreferencesResult {
  prefs: WizardPreferencesDoc
  isLoading: boolean
}

export function resolveWizardPreferences(
  inputs: ResolveWizardPreferencesInputs,
): ResolveWizardPreferencesResult {
  const { targetOperatorSlug, userRoles, minePrefs, fromTarget, fromAgentPreferred } = inputs

  if (targetOperatorSlug) {
    if (fromTarget === undefined) return { prefs: undefined, isLoading: true }
    return { prefs: fromTarget ?? null, isLoading: false }
  }

  if (userRoles === undefined || minePrefs === undefined) {
    return { prefs: undefined, isLoading: true }
  }

  const hasAgent = userRoles.some((r) => r.role === 'Agent')
  const agentPreferredSlug = hasAgent ? minePrefs?.preferredOperatorSlug : undefined

  if (agentPreferredSlug) {
    if (fromAgentPreferred === undefined) return { prefs: undefined, isLoading: true }
    return { prefs: fromAgentPreferred ?? minePrefs, isLoading: false }
  }

  return { prefs: minePrefs, isLoading: false }
}

export function useWizardPreferences(
  targetOperatorSlug?: string | null,
): ResolveWizardPreferencesResult {
  const { roles: userRoles } = useSessionIdentity()
  const minePrefs = useQuery(api.stakeholderPreferences.mine)

  const fromTarget = useQuery(
    api.stakeholderPreferences.bySlug,
    targetOperatorSlug ? { stakeholderSlug: targetOperatorSlug } : 'skip',
  )

  const hasAgent = userRoles?.some((r) => r.role === 'Agent') ?? false
  const agentPreferredSlug = !targetOperatorSlug && hasAgent ? minePrefs?.preferredOperatorSlug : undefined
  const fromAgentPreferred = useQuery(
    api.stakeholderPreferences.bySlug,
    agentPreferredSlug ? { stakeholderSlug: agentPreferredSlug } : 'skip',
  )

  return useMemo(
    () =>
      resolveWizardPreferences({
        targetOperatorSlug,
        userRoles,
        minePrefs,
        fromTarget,
        fromAgentPreferred,
      }),
    [targetOperatorSlug, userRoles, minePrefs, fromTarget, fromAgentPreferred],
  )
}
