import { describe, it, expect } from 'vitest'
import { constantTimeEqual } from '../../convex/lib/constantTimeEqual'

describe('constantTimeEqual', () => {
  it('returns true for identical buffers', () => {
    const a = new Uint8Array([1, 2, 3, 4])
    expect(constantTimeEqual(a, a)).toBe(true)
  })

  it('returns true for equal but distinct buffers', () => {
    const a = new Uint8Array([10, 20, 30])
    const b = new Uint8Array([10, 20, 30])
    expect(constantTimeEqual(a, b)).toBe(true)
  })

  it('returns false for different buffers', () => {
    const a = new Uint8Array([1, 2, 3])
    const b = new Uint8Array([1, 2, 4])
    expect(constantTimeEqual(a, b)).toBe(false)
  })

  it('returns false for different lengths', () => {
    const a = new Uint8Array([1, 2])
    const b = new Uint8Array([1, 2, 3])
    expect(constantTimeEqual(a, b)).toBe(false)
  })

  it('returns true for empty buffers', () => {
    expect(constantTimeEqual(new Uint8Array([]), new Uint8Array([]))).toBe(true)
  })

  it('returns false when only last byte differs', () => {
    const a = new Uint8Array([0, 0, 0, 0, 1])
    const b = new Uint8Array([0, 0, 0, 0, 2])
    expect(constantTimeEqual(a, b)).toBe(false)
  })

  it('returns false when only first byte differs', () => {
    const a = new Uint8Array([1, 0, 0])
    const b = new Uint8Array([2, 0, 0])
    expect(constantTimeEqual(a, b)).toBe(false)
  })
})
