// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { ROLES, type RoleConfig } from '@/lib/constants/roles'
import * as boats from '../../convex/boats'
import * as agents from '../../convex/agents'
import * as diveCenters from '../../convex/diveCenters'
import * as diveStaff from '../../convex/diveStaff'
import * as equipment from '../../convex/equipment'
import * as compressors from '../../convex/compressors'
import * as venues from '../../convex/venues'

const ROLE_MUTATION_MODULES = {
  'boat': boats,
  'agent': agents,
  'dive-center': diveCenters,
  'instructor': diveStaff,
  'equipment': equipment,
  'compressor': compressors,
  'venue': venues,
} as const

interface ValidatorJson {
  type: string
  optional?: boolean
  fields?: Record<string, ValidatorJson>
  value?: unknown
}

function exportArgsFor(mod: { create: { exportArgs: () => string } }): Record<string, ValidatorJson> {
  const json = JSON.parse(mod.create.exportArgs()) as ValidatorJson
  if (json.type !== 'object' || !json.value || typeof json.value !== 'object') {
    throw new Error(`Expected object validator at top level, got ${json.type}`)
  }
  return json.value as unknown as Record<string, ValidatorJson>
}

function isFieldRequired(field: ValidatorJson): boolean {
  if (typeof field === 'object' && field !== null && 'fieldType' in field) {
    const fieldRecord = field as unknown as { fieldType: ValidatorJson; optional: boolean }
    return !fieldRecord.optional
  }
  return !field.optional
}

function requiredKeys(args: Record<string, ValidatorJson>): Set<string> {
  const required = new Set<string>()
  for (const [name, field] of Object.entries(args)) {
    if (isFieldRequired(field)) required.add(name)
  }
  return required
}

const HANDLER_DEFAULTED_KEYS: Record<string, readonly string[]> = {
  'boat': [],
  'agent': [],
  'dive-center': [],
  'instructor': ['name', 'role'],
  'equipment': [],
  'compressor': [],
  'venue': [],
}

const FE_BASE_REQUIRED = ['address', 'lat', 'lng', 'email', 'phone'] as const

const VENUE_WIZARD_INJECTS = ['kind', 'features'] as const
const VENUE_WIZARD_FORM_FIELDS = ['name'] as const

function expectedFEKeysForRole(role: RoleConfig): Set<string> {
  const expected = new Set<string>(FE_BASE_REQUIRED)
  if (role.contact?.nameLabel) expected.add('name')
  if (role.contact?.languageKey) expected.add(role.contact.languageKey)
  if (role.contact?.payloadExtras && 'createDefaults' in role.contact.payloadExtras) {
    for (const k of Object.keys(role.contact.payloadExtras.createDefaults)) expected.add(k)
  }
  if (role.clerkRole === 'Venue') {
    for (const k of VENUE_WIZARD_INJECTS) expected.add(k)
    for (const k of VENUE_WIZARD_FORM_FIELDS) expected.add(k)
  }
  return expected
}

describe('role payload contract — FE-emitted required keys cover BE *.create required validator', () => {
  for (const role of ROLES) {
    it(`${role.key}: every required validator field has an FE source`, () => {
      const mod = ROLE_MUTATION_MODULES[role.key as keyof typeof ROLE_MUTATION_MODULES]
      const args = exportArgsFor(mod as unknown as { create: { exportArgs: () => string } })
      const beRequired = requiredKeys(args)
      const handlerDefaults = new Set(HANDLER_DEFAULTED_KEYS[role.key])
      const feProvided = expectedFEKeysForRole(role)

      const orphans: string[] = []
      for (const key of beRequired) {
        if (handlerDefaults.has(key)) continue
        if (feProvided.has(key)) continue
        orphans.push(key)
      }

      expect(
        orphans,
        `${role.key}.create requires fields the FE assembly does not produce: ${orphans.join(', ')}.\n` +
          `BE required: [${[...beRequired].sort().join(', ')}]\n` +
          `FE provides: [${[...feProvided].sort().join(', ')}]\n` +
          `Handler defaults: [${[...handlerDefaults].sort().join(', ')}]`,
      ).toEqual([])
    })
  }
})

describe('canonical-bug regression — boat.create requires fleet, FE must provide it', () => {
  it('detects when fleet is dropped from boat payloadExtras.createDefaults', () => {
    const fakeBoatRole: RoleConfig = {
      ...ROLES.find((r) => r.key === 'boat')!,
      contact: {
        ...ROLES.find((r) => r.key === 'boat')!.contact!,
        payloadExtras: { kind: 'boat', createDefaults: {} as { fleet: [] } },
      },
    }
    const args = exportArgsFor(boats as unknown as { create: { exportArgs: () => string } })
    const beRequired = requiredKeys(args)
    const fePartial = expectedFEKeysForRole(fakeBoatRole)
    const orphans = [...beRequired].filter((k) => !fePartial.has(k))
    expect(orphans).toContain('fleet')
  })
})
