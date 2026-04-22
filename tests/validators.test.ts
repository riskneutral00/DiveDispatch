import { describe, it, expect } from 'vitest'
import { stakeholderTypeValidator } from '../convex/lib/validators'
import { OPERATOR_TYPES } from '../convex/shared/operatorTypes'

describe('stakeholderType rejects dropped roles', () => {
  it('does not accept Liveaboard', () => {
    expect(() =>
      (stakeholderTypeValidator as unknown as { validate: (v: unknown) => unknown }).validate?.('Liveaboard'),
    ).not.toThrow()
    // Use Infer-level check: 'Liveaboard' is no longer in the union
    const union = stakeholderTypeValidator as unknown as { members?: Array<{ value: string }> }
    const values = (union.members ?? []).map((m) => m.value)
    expect(values).not.toContain('Liveaboard')
    expect(values).not.toContain('DiveResort')
    expect(values).not.toContain('DiveHostel')
  })

  it('still accepts the seven remaining roles', () => {
    const union = stakeholderTypeValidator as unknown as { members?: Array<{ value: string }> }
    const values = new Set((union.members ?? []).map((m) => m.value))
    expect(values.has('DiveCenter')).toBe(true)
    expect(values.has('Agent')).toBe(true)
    expect(values.has('Instructor')).toBe(true)
    expect(values.has('Boat')).toBe(true)
    expect(values.has('Equipment')).toBe(true)
    expect(values.has('Compressor')).toBe(true)
    expect(values.has('Venue')).toBe(true)
  })
})

describe('OPERATOR_TYPES no longer contains dropped roles', () => {
  it('contains only DiveCenter + Agent', () => {
    expect([...OPERATOR_TYPES].sort()).toEqual(['Agent', 'DiveCenter'])
  })
})
