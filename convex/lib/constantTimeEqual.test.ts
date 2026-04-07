import { describe, it, expect } from 'vitest'
import { constantTimeEqual } from './constantTimeEqual'

describe('constantTimeEqual', () => {
  it('returns true for identical buffers', () => {
    const a = new Uint8Array([1, 2, 3, 4, 5])
    const b = new Uint8Array([1, 2, 3, 4, 5])
    expect(constantTimeEqual(a, b)).toBe(true)
  })

  it('returns false for buffers differing in the first byte', () => {
    const a = new Uint8Array([0, 2, 3, 4, 5])
    const b = new Uint8Array([1, 2, 3, 4, 5])
    expect(constantTimeEqual(a, b)).toBe(false)
  })

  it('returns false for buffers differing in the last byte', () => {
    const a = new Uint8Array([1, 2, 3, 4, 5])
    const b = new Uint8Array([1, 2, 3, 4, 6])
    expect(constantTimeEqual(a, b)).toBe(false)
  })

  it('returns false for buffers of different lengths', () => {
    const a = new Uint8Array([1, 2, 3])
    const b = new Uint8Array([1, 2, 3, 4])
    expect(constantTimeEqual(a, b)).toBe(false)
  })

  it('returns true for two empty buffers', () => {
    const a = new Uint8Array([])
    const b = new Uint8Array([])
    expect(constantTimeEqual(a, b)).toBe(true)
  })

  it('returns false when only one buffer is empty', () => {
    const a = new Uint8Array([])
    const b = new Uint8Array([1])
    expect(constantTimeEqual(a, b)).toBe(false)
  })

  it('returns false for completely different buffers of same length', () => {
    const a = new Uint8Array([0, 0, 0, 0])
    const b = new Uint8Array([255, 255, 255, 255])
    expect(constantTimeEqual(a, b)).toBe(false)
  })

  it('compares all bytes even when first bytes differ (constant-time property)', () => {
    const base = new Uint8Array([10, 20, 30, 40, 50])
    for (let i = 0; i < base.length; i++) {
      const modified = new Uint8Array(base)
      modified[i] = modified[i]! ^ 0xff
      expect(constantTimeEqual(base, modified)).toBe(false)
    }
  })
})
