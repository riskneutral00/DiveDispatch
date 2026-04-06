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

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('')
  })

  it('handles many arguments', () => {
    expect(cn('a', 'b', 'c', 'd', 'e', 'f')).toBe('a b c d e f')
  })

  it('handles mixed truthy and falsy', () => {
    expect(cn('base', true && 'active', false && 'hidden', null, 'end')).toBe('base active end')
  })

  it('resolves conflicting Tailwind classes (last wins)', () => {
    expect(cn('text-sm', 'text-lg')).toBe('text-lg')
  })

  it('keeps non-conflicting Tailwind classes', () => {
    expect(cn('text-sm', 'font-bold', 'mt-4')).toBe('text-sm font-bold mt-4')
  })

  it('accepts array inputs via clsx', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c')
  })

  it('accepts object inputs via clsx', () => {
    expect(cn({ active: true, hidden: false }, 'base')).toBe('active base')
  })
})
