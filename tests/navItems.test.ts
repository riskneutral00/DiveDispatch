import { describe, it, expect } from 'vitest'
import { buildNavItems } from '../src/lib/nav-items'

describe('buildNavItems', () => {
  const items = buildNavItems('dive-center', 'alice')

  it('returns 2 nav items', () => {
    expect(items).toHaveLength(2)
  })

  it('includes dashboard and directory only', () => {
    const keys = items.map((i) => i.key)
    expect(keys).toContain('dashboard')
    expect(keys).toContain('directory')
    expect(keys).not.toContain('workspace')
  })

  it('dashboard href is /{slug}/{roleSlug}', () => {
    expect(items.find((i) => i.key === 'dashboard')!.href).toBe('/alice/dive-center')
  })

  it('directory href is /directory', () => {
    expect(items.find((i) => i.key === 'directory')!.href).toBe('/directory')
  })

  it('all items have Icon component', () => {
    for (const item of items) {
      expect(item.Icon).not.toBeNull()
    }
  })

  it('all items have non-empty labels', () => {
    for (const item of items) {
      expect(item.label.length).toBeGreaterThan(0)
    }
  })
})
