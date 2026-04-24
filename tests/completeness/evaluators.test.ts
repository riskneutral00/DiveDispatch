import { describe, it, expect } from 'vitest'
import {
  scalarString,
  nestedAddress,
  arrayNonEmpty,
  credentialEvaluator,
  associationEvaluator,
  fleetEvaluator,
  nestedPathPredicate,
} from '../../convex/lib/completeness/evaluators'
import type { EvaluatorContext } from '../../convex/lib/completeness/types'

function makeCtx(profile: Record<string, unknown> | null): EvaluatorContext {
  // mock-ok: pure evaluators (scalar, address, array, credential, association, fleet, nestedPathPredicate) don't touch ctx — null cast is safe for these tests only.
  return {
    ctx: null as unknown as EvaluatorContext['ctx'],
    userDoc: null as unknown as EvaluatorContext['userDoc'],
    profile,
    role: 'Test',
    activeOrgId: null,
  }
}

describe('scalarString', () => {
  it('slot=1 empty incomplete when field is non-empty string', async () => {
    const ev = scalarString('name')
    expect(await ev(makeCtx({ name: 'Alice' }))).toEqual({ slots: 1, incomplete: [] })
  })
  it('slot=1 incomplete=[field] when missing or empty', async () => {
    const ev = scalarString('name')
    expect(await ev(makeCtx({ name: '' }))).toEqual({ slots: 1, incomplete: ['name'] })
    expect(await ev(makeCtx({}))).toEqual({ slots: 1, incomplete: ['name'] })
  })
  it('slot=1 incomplete=[field] when profile is null', async () => {
    const ev = scalarString('name')
    expect(await ev(makeCtx(null))).toEqual({ slots: 1, incomplete: ['name'] })
  })
})

describe('nestedAddress', () => {
  it('complete when city AND country are non-empty', async () => {
    const ev = nestedAddress()
    expect(await ev(makeCtx({ address: { city: 'Koh Tao', country: 'TH' } }))).toEqual({ slots: 1, incomplete: [] })
  })
  it('incomplete when city missing', async () => {
    const ev = nestedAddress()
    expect(await ev(makeCtx({ address: { country: 'TH' } }))).toEqual({ slots: 1, incomplete: ['address'] })
  })
  it('incomplete when profile null', async () => {
    const ev = nestedAddress()
    expect(await ev(makeCtx(null))).toEqual({ slots: 1, incomplete: ['address'] })
  })
})

describe('arrayNonEmpty', () => {
  it('complete when array has >=1 entry (no deepValid)', async () => {
    const ev = arrayNonEmpty('customerLanguages')
    expect(await ev(makeCtx({ customerLanguages: ['en'] }))).toEqual({ slots: 1, incomplete: [] })
  })
  it('incomplete when array empty', async () => {
    const ev = arrayNonEmpty('customerLanguages')
    expect(await ev(makeCtx({ customerLanguages: [] }))).toEqual({ slots: 1, incomplete: ['customerLanguages'] })
  })
  it('deepValid failure marks incomplete', async () => {
    const ev = arrayNonEmpty('fleet', { deepValid: (e) => e.every((x) => typeof (x as { a?: unknown }).a === 'string') })
    expect(await ev(makeCtx({ fleet: [{ a: 'x' }, { a: 1 }] }))).toEqual({ slots: 1, incomplete: ['fleet'] })
  })
})

describe('credentialEvaluator', () => {
  it('requireSpecialties=true: all entries must have agency+level+agencyID+specialtyRatings array', async () => {
    const ev = credentialEvaluator({ requireSpecialties: true })
    const good = { credential: [{ agency: 'PADI', level: 'DM', agencyID: 'X', specialtyRatings: [] }] }
    expect(await ev(makeCtx(good))).toEqual({ slots: 1, incomplete: [] })
    const missingSpecialties = { credential: [{ agency: 'PADI', level: 'DM', agencyID: 'X' }] }
    expect(await ev(makeCtx(missingSpecialties))).toEqual({ slots: 1, incomplete: ['credential'] })
  })
})

describe('associationEvaluator', () => {
  it('minSpecialties=0: agency+number alone passes', async () => {
    const ev = associationEvaluator({ minSpecialties: 0 })
    expect(await ev(makeCtx({ associations: [{ agency: 'PADI', number: '123' }] }))).toEqual({ slots: 1, incomplete: [] })
  })
  it('minSpecialties=5: requires selectedSpecialties.length >= 5', async () => {
    const ev = associationEvaluator({ minSpecialties: 5 })
    const tooFew = { associations: [{ agency: 'PADI', number: '123', selectedSpecialties: ['a', 'b'] }] }
    expect(await ev(makeCtx(tooFew))).toEqual({ slots: 1, incomplete: ['associations'] })
    const enough = { associations: [{ agency: 'PADI', number: '123', selectedSpecialties: ['a', 'b', 'c', 'd', 'e'] }] }
    expect(await ev(makeCtx(enough))).toEqual({ slots: 1, incomplete: [] })
  })
})

describe('fleetEvaluator', () => {
  it('entries must have boatName + maxPax>=1', async () => {
    const ev = fleetEvaluator()
    expect(await ev(makeCtx({ fleet: [{ boatName: 'B1', maxPax: 5 }] }))).toEqual({ slots: 1, incomplete: [] })
    expect(await ev(makeCtx({ fleet: [{ boatName: 'B1', maxPax: 0 }] }))).toEqual({ slots: 1, incomplete: ['fleet'] })
    expect(await ev(makeCtx({ fleet: [{ boatName: '', maxPax: 5 }] }))).toEqual({ slots: 1, incomplete: ['fleet'] })
  })
})

describe('nestedPathPredicate', () => {
  it('slots=1, label from options', async () => {
    const ev = nestedPathPredicate({
      label: 'diveSite',
      predicate: (p) => !!(p as { fleet?: Array<{ routes?: Array<{ diveSite: string }> }> }).fleet
        ?.some((f) => f.routes?.some((r) => r.diveSite)),
    })
    expect(await ev(makeCtx({ fleet: [{ routes: [{ diveSite: 'chumphon' }] }] }))).toEqual({ slots: 1, incomplete: [] })
    expect(await ev(makeCtx({ fleet: [{ routes: [] }] }))).toEqual({ slots: 1, incomplete: ['diveSite'] })
    expect(await ev(makeCtx(null))).toEqual({ slots: 1, incomplete: ['diveSite'] })
  })
})
