// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useStableKeys } from '../use-stable-keys'

describe('useStableKeys', () => {
  it('returns N unique keys for N items on initial render', () => {
    const a = { id: 'a' }
    const b = { id: 'b' }
    const c = { id: 'c' }
    const { result } = renderHook(({ items }) => useStableKeys(items), {
      initialProps: { items: [a, b, c] },
    })
    expect(result.current).toHaveLength(3)
    expect(new Set(result.current).size).toBe(3)
  })

  it('returns [] for empty list', () => {
    const { result } = renderHook(({ items }) => useStableKeys(items), {
      initialProps: { items: [] as unknown[] },
    })
    expect(result.current).toEqual([])
  })

  it('keeps positional keys on edit-in-place (spread-copy at idx)', () => {
    const a = { agency: 'PADI' }
    const b = { agency: 'SSI' }
    const { result, rerender } = renderHook(({ items }) => useStableKeys(items), {
      initialProps: { items: [a, b] as Array<{ agency: string }> },
    })
    const before = result.current
    const bEdited = { ...b, agency: 'NAUI' }
    rerender({ items: [a, bEdited] })
    expect(result.current).toEqual(before)
  })

  it('appends a new key on add; prior keys stable', () => {
    const a = { id: 'a' }
    const b = { id: 'b' }
    const { result, rerender } = renderHook(({ items }) => useStableKeys(items), {
      initialProps: { items: [a] as Array<{ id: string }> },
    })
    const [aKey] = result.current
    rerender({ items: [a, b] })
    expect(result.current[0]).toBe(aKey)
    expect(result.current[1]).not.toBe(aKey)
    expect(result.current).toHaveLength(2)
  })

  it('removes the correct key when first item is removed', () => {
    const a = { id: 'a' }
    const b = { id: 'b' }
    const c = { id: 'c' }
    const { result, rerender } = renderHook(({ items }) => useStableKeys(items), {
      initialProps: { items: [a, b, c] as Array<{ id: string }> },
    })
    const [, bKey, cKey] = result.current
    rerender({ items: [b, c] })
    expect(result.current).toEqual([bKey, cKey])
  })

  it('removes the correct key when middle item is removed', () => {
    const a = { id: 'a' }
    const b = { id: 'b' }
    const c = { id: 'c' }
    const { result, rerender } = renderHook(({ items }) => useStableKeys(items), {
      initialProps: { items: [a, b, c] as Array<{ id: string }> },
    })
    const [aKey, , cKey] = result.current
    rerender({ items: [a, c] })
    expect(result.current).toEqual([aKey, cKey])
  })

  it('removes the correct key when last item is removed', () => {
    const a = { id: 'a' }
    const b = { id: 'b' }
    const c = { id: 'c' }
    const { result, rerender } = renderHook(({ items }) => useStableKeys(items), {
      initialProps: { items: [a, b, c] as Array<{ id: string }> },
    })
    const [aKey, bKey] = result.current
    rerender({ items: [a, b] })
    expect(result.current).toEqual([aKey, bKey])
  })

  it('regenerates keys for wholesale replacement (resetToBaseline with different refs)', () => {
    const a = { id: 'a' }
    const b = { id: 'b' }
    const { result, rerender } = renderHook(({ items }) => useStableKeys(items), {
      initialProps: { items: [a, b] as Array<{ id: string }> },
    })
    const before = result.current
    const aClone = { id: 'a' }
    const bClone = { id: 'b' }
    rerender({ items: [aClone, bClone] })
    expect(result.current).toEqual(before)
  })

  it('inherits keys for survivors after partial replacement', () => {
    const a = { id: 'a' }
    const b = { id: 'b' }
    const c = { id: 'c' }
    const { result, rerender } = renderHook(({ items }) => useStableKeys(items), {
      initialProps: { items: [a, b, c] as Array<{ id: string }> },
    })
    const [, , cKey] = result.current
    rerender({ items: [c] })
    expect(result.current).toEqual([cKey])
  })

  it('handles empty → populated', () => {
    const { result, rerender } = renderHook(({ items }) => useStableKeys(items), {
      initialProps: { items: [] as Array<{ id: string }> },
    })
    expect(result.current).toEqual([])
    rerender({ items: [{ id: 'a' }, { id: 'b' }] })
    expect(result.current).toHaveLength(2)
    expect(new Set(result.current).size).toBe(2)
  })

  it('handles populated → empty', () => {
    const { result, rerender } = renderHook(({ items }) => useStableKeys(items), {
      initialProps: { items: [{ id: 'a' }, { id: 'b' }] as Array<{ id: string }> },
    })
    rerender({ items: [] })
    expect(result.current).toEqual([])
  })

  it('sequence: add, edit, remove preserves identity correctly', () => {
    const a = { agency: 'PADI', number: '' }
    const { result, rerender } = renderHook(({ items }) => useStableKeys(items), {
      initialProps: { items: [a] as Array<{ agency: string; number: string }> },
    })
    const [aKey] = result.current

    const b = { agency: '', number: '' }
    rerender({ items: [a, b] })
    const [, bKey] = result.current
    expect(result.current[0]).toBe(aKey)
    expect(bKey).not.toBe(aKey)

    const aEdited = { ...a, number: '123' }
    rerender({ items: [aEdited, b] })
    expect(result.current).toEqual([aKey, bKey])

    rerender({ items: [b] })
    expect(result.current).toEqual([bKey])
  })

  it('returns same array reference when input array reference is unchanged', () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    const { result, rerender } = renderHook(({ items }) => useStableKeys(items), {
      initialProps: { items },
    })
    const first = result.current
    rerender({ items })
    expect(result.current).toBe(first)
  })
})
