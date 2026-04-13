import { describe, it, expect } from 'vitest'
import type { Doc } from '../../../../convex/_generated/dataModel'
import { resolveWizardPreferences } from '../use-wizard-preferences'

type Prefs = Doc<'stakeholderPreferences'>

function prefs(overrides: Partial<Prefs> = {}): Prefs {
  return {
    _id: 'pref-id' as Prefs['_id'],
    _creationTime: 0,
    stakeholderId: 'owner-slug',
    stakeholderType: 'DiveCenter',
    acceptanceMode: 'Auto',
    useNamedUnits: false,
    commonLanguageCodes: ['en'],
    confirmOnAccept: true,
    confirmOnDecline: true,
    ...overrides,
  } as Prefs
}

describe('resolveWizardPreferences', () => {
  it('returns target prefs when targetOperatorSlug is set', () => {
    const target = prefs({ preferredInstructorSlugs: ['target-inst'] })
    const result = resolveWizardPreferences({
      targetOperatorSlug: 'target-dc',
      userRoles: [{ role: 'Agent' }],
      minePrefs: prefs({ preferredInstructorSlugs: ['mine'] }),
      fromTarget: target,
      fromAgentPreferred: undefined,
    })
    expect(result.isLoading).toBe(false)
    expect(result.prefs?.preferredInstructorSlugs).toEqual(['target-inst'])
  })

  it('returns loading when target query still fetching', () => {
    const result = resolveWizardPreferences({
      targetOperatorSlug: 'target-dc',
      userRoles: [{ role: 'Agent' }],
      minePrefs: prefs(),
      fromTarget: undefined,
      fromAgentPreferred: undefined,
    })
    expect(result.isLoading).toBe(true)
    expect(result.prefs).toBeUndefined()
  })

  it('returns null prefs when target has no prefs row', () => {
    const result = resolveWizardPreferences({
      targetOperatorSlug: 'target-dc',
      userRoles: [{ role: 'Agent' }],
      minePrefs: prefs(),
      fromTarget: null,
      fromAgentPreferred: undefined,
    })
    expect(result.isLoading).toBe(false)
    expect(result.prefs).toBeNull()
  })

  it('returns loading when userRoles or minePrefs still fetching (no target)', () => {
    const rolesLoading = resolveWizardPreferences({
      targetOperatorSlug: null,
      userRoles: undefined,
      minePrefs: prefs(),
      fromTarget: undefined,
      fromAgentPreferred: undefined,
    })
    expect(rolesLoading.isLoading).toBe(true)

    const prefsLoading = resolveWizardPreferences({
      targetOperatorSlug: null,
      userRoles: [{ role: 'Agent' }],
      minePrefs: undefined,
      fromTarget: undefined,
      fromAgentPreferred: undefined,
    })
    expect(prefsLoading.isLoading).toBe(true)
  })

  it('Agent with preferredOperatorSlug resolves to operator prefs', () => {
    const operator = prefs({ preferredInstructorSlugs: ['pref-dc-inst'] })
    const result = resolveWizardPreferences({
      targetOperatorSlug: null,
      userRoles: [{ role: 'Agent' }],
      minePrefs: prefs({
        preferredOperatorSlug: 'pref-dc',
        preferredInstructorSlugs: ['agent-own'],
      }),
      fromTarget: undefined,
      fromAgentPreferred: operator,
    })
    expect(result.isLoading).toBe(false)
    expect(result.prefs?.preferredInstructorSlugs).toEqual(['pref-dc-inst'])
  })

  it('Agent with no preferredOperatorSlug falls back to own prefs', () => {
    const mine = prefs({ preferredInstructorSlugs: ['agent-own'] })
    const result = resolveWizardPreferences({
      targetOperatorSlug: null,
      userRoles: [{ role: 'Agent' }],
      minePrefs: mine,
      fromTarget: undefined,
      fromAgentPreferred: undefined,
    })
    expect(result.isLoading).toBe(false)
    expect(result.prefs?.preferredInstructorSlugs).toEqual(['agent-own'])
  })

  it('Agent with preferredOperatorSlug but operator prefs null falls back to own prefs', () => {
    const mine = prefs({
      preferredOperatorSlug: 'pref-dc',
      preferredInstructorSlugs: ['agent-own'],
    })
    const result = resolveWizardPreferences({
      targetOperatorSlug: null,
      userRoles: [{ role: 'Agent' }],
      minePrefs: mine,
      fromTarget: undefined,
      fromAgentPreferred: null,
    })
    expect(result.isLoading).toBe(false)
    expect(result.prefs?.preferredInstructorSlugs).toEqual(['agent-own'])
  })

  it('Agent with preferredOperatorSlug still loading operator prefs returns loading', () => {
    const result = resolveWizardPreferences({
      targetOperatorSlug: null,
      userRoles: [{ role: 'Agent' }],
      minePrefs: prefs({ preferredOperatorSlug: 'pref-dc' }),
      fromTarget: undefined,
      fromAgentPreferred: undefined,
    })
    expect(result.isLoading).toBe(true)
    expect(result.prefs).toBeUndefined()
  })

  it('non-Agent caller returns own minePrefs without consulting fromAgentPreferred', () => {
    const mine = prefs({
      preferredOperatorSlug: 'ignored',
      preferredInstructorSlugs: ['mine'],
    })
    const result = resolveWizardPreferences({
      targetOperatorSlug: null,
      userRoles: [{ role: 'DiveCenter' }],
      minePrefs: mine,
      fromTarget: undefined,
      fromAgentPreferred: undefined,
    })
    expect(result.isLoading).toBe(false)
    expect(result.prefs?.preferredInstructorSlugs).toEqual(['mine'])
  })

  it('target argument wins over preferredOperatorSlug cascade', () => {
    const target = prefs({ preferredInstructorSlugs: ['target-inst'] })
    const operator = prefs({ preferredInstructorSlugs: ['pref-dc-inst'] })
    const result = resolveWizardPreferences({
      targetOperatorSlug: 'target-dc',
      userRoles: [{ role: 'Agent' }],
      minePrefs: prefs({
        preferredOperatorSlug: 'pref-dc',
        preferredInstructorSlugs: ['agent-own'],
      }),
      fromTarget: target,
      fromAgentPreferred: operator,
    })
    expect(result.isLoading).toBe(false)
    expect(result.prefs?.preferredInstructorSlugs).toEqual(['target-inst'])
  })
})
