import { describe, it, expect } from 'vitest'
import { cn } from '../src/lib/utils/cn'

describe('cn', () => {
  it('joins multiple class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c')
  })

  it('filters out false values', () => {
    expect(cn('base', false && 'hidden')).toBe('base')
  })

  it('filters out null and undefined', () => {
    expect(cn('base', null, undefined, 'end')).toBe('base end')
  })

  it('returns empty string when all inputs are falsy', () => {
    expect(cn(false, null, undefined)).toBe('')
  })

  it('returns single class name', () => {
    expect(cn('only')).toBe('only')
  })
})
