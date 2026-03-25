import { describe, it, expect } from 'vitest'
import { toggleInArray } from '../src/lib/utils/arrays'

describe('toggleInArray', () => {
  it('appends a value not present in the array', () => {
    expect(toggleInArray(['a', 'b'], 'c')).toEqual(['a', 'b', 'c'])
  })

  it('removes a value already present in the array', () => {
    expect(toggleInArray(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })

  it('returns a new array (no mutation)', () => {
    const original = ['x']
    const result = toggleInArray(original, 'y')
    expect(result).not.toBe(original)
    expect(original).toEqual(['x'])
  })

  it('handles empty array — appends', () => {
    expect(toggleInArray([], 'z')).toEqual(['z'])
  })

  it('handles removing last item', () => {
    expect(toggleInArray(['only'], 'only')).toEqual([])
  })
})
