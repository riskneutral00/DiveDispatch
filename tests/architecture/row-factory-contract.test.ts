/**
 * RED baseline for the canonical row-factory layer (Task 5).
 *
 * Inventoried schema-backed repeating-row editors (Task 1):
 *   - dive-center associations: src/lib/schemas/profile-shared.ts diveCenterAssociationItemSchema
 *     factory currently: makeDefaultAssoc in src/components/profiles/dive-center-profile-form.tsx:53-66
 *   - agent associations: associationSchema (profile-shared.ts:24-27)
 *     factory currently inline in profile-agency-info.tsx
 *   - personal credentials: instructorCredentialSchema (profile-shared.ts:35-37)
 *     factory currently: makeEmptyCredential in personal-profile-form.tsx:30-32
 *   - boat fleet entries: boatFleetEntrySchema (profile-shared.ts:99-120)
 *     factory currently: emptyFleet in boat-profile-form.tsx:46-55
 *   - boat routes: boatRouteSchema (profile-shared.ts:94-97)
 *     factory currently: emptyRoute in boat-profile-form.tsx:57-59
 *   - venue capabilities: venueCapabilitiesSchema (profile-shared.ts:170-196)
 *     factory currently: EMPTY_VENUE_FORM + inheritDraftForm in venue-form-body.tsx /
 *     venue-capabilities-section.tsx:71-117
 *
 * Contract (Task 5):
 *   - Each schema gets a colocated `make*Default` factory in src/lib/schemas/.
 *   - Each factory accepts an optional Partial<Row> override.
 *   - Each schema declares a colocated `userEntered: readonly [...]` allowlist.
 *   - A schema-introspective harness asserts: for every required field in the schema,
 *     either factory output passes that field's check OR the field is on userEntered.
 *   - For (schema, fromProfile) pairs: minimal valid persisted record → form state
 *     fails schema only on userEntered paths.
 *
 * These assertions are EXPECTED TO FAIL until Task 5 ships the colocated factories.
 */
import { describe, expect, it } from 'vitest'
import * as schemas from '@/lib/schemas/profile-shared'

type FactoryExport<T> = ((override?: Partial<T>) => T) | undefined

const mod = schemas as unknown as Record<string, unknown>

describe('row-factory contract — colocation with Zod schemas (Task 5)', () => {
  const expectedFactories = [
    'makeDefaultDiveCenterAssociation',
    'makeDefaultAgentAssociation',
    'makeDefaultInstructorCredential',
    'makeDefaultBoatFleetEntry',
    'makeDefaultBoatRoute',
    'makeDefaultVenueCapabilities',
  ] as const

  for (const name of expectedFactories) {
    it(`exports ${name} colocated with its schema`, () => {
      expect(
        typeof mod[name],
        `${name} must be exported from src/lib/schemas/profile-shared.ts (Task 5)`,
      ).toBe('function')
    })
  }

  const expectedAllowlists = [
    'diveCenterAssociationUserEntered',
    'agentAssociationUserEntered',
    'instructorCredentialUserEntered',
    'boatFleetEntryUserEntered',
    'boatRouteUserEntered',
    'venueCapabilitiesUserEntered',
  ] as const

  for (const name of expectedAllowlists) {
    it(`exports ${name} userEntered allowlist colocated with its schema`, () => {
      const v = mod[name]
      expect(Array.isArray(v), `${name} must be a readonly tuple of field paths`).toBe(true)
    })
  }
})

describe('row-factory contract — Partial<Row> override behavior (Task 5)', () => {
  it('makeDefaultDiveCenterAssociation accepts a Partial override', () => {
    const fn = mod.makeDefaultDiveCenterAssociation as FactoryExport<{ agency: string }>
    expect(typeof fn, 'factory must exist before override behavior can be checked').toBe('function')
    if (typeof fn !== 'function') return
    const row = fn({ agency: 'PADI' })
    expect(row.agency).toBe('PADI')
  })

  it('makeDefaultBoatFleetEntry accepts a Partial override', () => {
    const fn = mod.makeDefaultBoatFleetEntry as FactoryExport<{ boatName: string }>
    expect(typeof fn, 'factory must exist before override behavior can be checked').toBe('function')
    if (typeof fn !== 'function') return
    const row = fn({ boatName: 'MV Dolphin' })
    expect(row.boatName).toBe('MV Dolphin')
  })
})

describe('row-factory contract — schema-introspective harness (Task 5)', () => {
  // Each entry: schema + factory name + userEntered allowlist name.
  const cases: { label: string; schemaKey: string; factoryKey: string; allowlistKey: string }[] = [
    {
      label: 'dive-center association',
      schemaKey: 'diveCenterAssociationItemSchema',
      factoryKey: 'makeDefaultDiveCenterAssociation',
      allowlistKey: 'diveCenterAssociationUserEntered',
    },
    {
      label: 'agent association',
      schemaKey: 'associationSchema',
      factoryKey: 'makeDefaultAgentAssociation',
      allowlistKey: 'agentAssociationUserEntered',
    },
    {
      label: 'instructor credential',
      schemaKey: 'instructorCredentialSchema',
      factoryKey: 'makeDefaultInstructorCredential',
      allowlistKey: 'instructorCredentialUserEntered',
    },
    {
      label: 'boat fleet entry',
      schemaKey: 'boatFleetEntrySchema',
      factoryKey: 'makeDefaultBoatFleetEntry',
      allowlistKey: 'boatFleetEntryUserEntered',
    },
    {
      label: 'boat route',
      schemaKey: 'boatRouteSchema',
      factoryKey: 'makeDefaultBoatRoute',
      allowlistKey: 'boatRouteUserEntered',
    },
    {
      label: 'venue capabilities',
      schemaKey: 'venueCapabilitiesSchema',
      factoryKey: 'makeDefaultVenueCapabilities',
      allowlistKey: 'venueCapabilitiesUserEntered',
    },
  ]

  for (const c of cases) {
    it(`${c.label}: factory output fails schema only on userEntered paths`, () => {
      // Note: diveCenterAssociationItemSchema and boatRouteSchema are not currently
      // exported from profile-shared.ts. Task 5 must export them so this harness
      // can introspect them. Expected RED state: schema or factory or allowlist
      // missing -> test fails clean.
      const schema = mod[c.schemaKey] as
        | { safeParse: (input: unknown) => { success: boolean; error?: { issues: { path: (string | number)[] }[] } } }
        | undefined
      const factory = mod[c.factoryKey] as FactoryExport<Record<string, unknown>>
      const allowlist = mod[c.allowlistKey] as readonly string[] | undefined

      expect(schema, `${c.schemaKey} must be exported from profile-shared.ts`).toBeTruthy()
      expect(typeof factory, `${c.factoryKey} must be a function`).toBe('function')
      expect(Array.isArray(allowlist), `${c.allowlistKey} must be a readonly tuple`).toBe(true)
      if (!schema || typeof factory !== 'function' || !Array.isArray(allowlist)) return

      const result = schema.safeParse(factory())
      if (result.success) return
      const failedPaths = (result.error?.issues ?? []).map((i) =>
        i.path.map(String).join('.'),
      )
      const violations = failedPaths.filter(
        (p) => !allowlist.includes(p) && !allowlist.some((allowed) => p.startsWith(`${allowed}.`)),
      )
      expect(
        violations,
        `${c.label}: factory output failed on non-userEntered paths: ${violations.join(', ')}`,
      ).toEqual([])
    })
  }
})

describe('row-factory contract — clone-on-add semantics (Task 6 preserves)', () => {
  it('canonical dive-center association factory accepts a seed override carrying day fields', () => {
    // Today the clone behavior lives inline in dive-center-profile-form.tsx:113-122.
    // Post-refactor the factory must expose seeded creation via Partial<Row> override.
    const fn = mod.makeDefaultDiveCenterAssociation as FactoryExport<{
      agency: string
      number: string
      owDays: number | undefined
      aowDays: number | undefined
      oaDays: number | undefined
      selectedSpecialties: string[]
    }>
    expect(typeof fn, 'canonical factory must exist before clone-on-add semantics can be tested').toBe(
      'function',
    )
    if (typeof fn !== 'function') return
    const cloned = fn({ owDays: 4, aowDays: 2, oaDays: 1, selectedSpecialties: ['deep'] })
    expect(cloned.owDays).toBe(4)
    expect(cloned.aowDays).toBe(2)
    expect(cloned.oaDays).toBe(1)
    expect(cloned.selectedSpecialties).toEqual(['deep'])
    expect(cloned.agency, 'cloned row leaves agency blank for fresh user input').toBe('')
    expect(cloned.number, 'cloned row leaves number blank for fresh user input').toBe('')
  })
})

describe('row-factory contract — venue inheritance semantics (Task 8 preserves)', () => {
  it('canonical venue factory exposes a same-kind/cross-kind inherit helper', () => {
    const fn = mod.makeVenueDraftFromPrior as
      | ((args: { prior: unknown; targetKind: 'pool' | 'dive_site'; inherited: { email?: string; phone?: string } }) => unknown)
      | undefined
    expect(
      typeof fn,
      'makeVenueDraftFromPrior must be exported from profile-shared.ts (Task 8 colocates inheritDraftForm)',
    ).toBe('function')
  })

  it('canonical pool venue factory omits confinedCapable from create payload (Task 8)', () => {
    // Post-refactor: makeDefaultVenueCapabilities({ kind: 'pool' }) plus a colocated
    // toCreatePayload helper must omit confinedCapable so backend derivation owns it.
    const toCreatePayload = mod.venueCapabilitiesToCreatePayload as
      | ((form: Record<string, unknown>) => Record<string, unknown>)
      | undefined
    expect(
      typeof toCreatePayload,
      'venueCapabilitiesToCreatePayload must be colocated with the schema (Task 8)',
    ).toBe('function')
    if (typeof toCreatePayload !== 'function') return
    const payload = toCreatePayload({
      kind: 'pool',
      features: [],
      confinedCapable: false,
      maxDepth: 3,
      maxCapacity: 10,
    })
    expect(
      'confinedCapable' in payload,
      'pool create payload must omit confinedCapable so backend derivation sets it to true',
    ).toBe(false)
  })
})
