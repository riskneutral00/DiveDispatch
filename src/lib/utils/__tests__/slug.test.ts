import { describe, it, expect } from 'vitest'
import { kebabBusinessName, appendCollisionHash } from '../slug'

describe('kebabBusinessName', () => {
  it('lowercases and joins single space', () => {
    expect(kebabBusinessName('Hug Ocean')).toBe('hug-ocean')
  })

  it('collapses multiple spaces into one hyphen', () => {
    expect(kebabBusinessName('Hug   Ocean   Diving')).toBe('hug-ocean-diving')
  })

  it('trims leading/trailing whitespace', () => {
    expect(kebabBusinessName('  Hug Ocean  ')).toBe('hug-ocean')
  })

  it('strips ampersands and other punctuation', () => {
    expect(kebabBusinessName('Tom & Jerry Dive Co.')).toBe('tom-jerry-dive-co')
  })

  it('handles unicode by stripping non-ASCII', () => {
    expect(kebabBusinessName('Café Diving')).toBe('caf-diving')
  })

  it('collapses adjacent separators (hyphens / underscores) into one', () => {
    expect(kebabBusinessName('Dive--Center__Bali')).toBe('dive-center-bali')
  })

  it('preserves digits', () => {
    expect(kebabBusinessName('Dive Spot 7')).toBe('dive-spot-7')
  })

  it('returns empty string for empty input', () => {
    expect(kebabBusinessName('')).toBe('')
    expect(kebabBusinessName('   ')).toBe('')
  })

  it('returns empty when all chars stripped', () => {
    expect(kebabBusinessName('!@#$%')).toBe('')
  })
})

describe('appendCollisionHash', () => {
  it('appends a 6-char hyphen-prefixed suffix', () => {
    const result = appendCollisionHash('hug-ocean')
    expect(result).toMatch(/^hug-ocean-[a-z0-9]{6}$/)
  })

  it('preserves the input slug as prefix', () => {
    const result = appendCollisionHash('test-co')
    expect(result.startsWith('test-co-')).toBe(true)
  })

  it('produces different suffixes on repeated calls', () => {
    const a = appendCollisionHash('x')
    const b = appendCollisionHash('x')
    expect(a).not.toBe(b)
  })
})
