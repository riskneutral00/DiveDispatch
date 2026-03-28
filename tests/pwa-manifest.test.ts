import { describe, it, expect } from 'vitest'
import manifest from '../src/app/manifest'

describe('PWA Web App Manifest', () => {
  const m = manifest()

  it('has correct app name', () => {
    expect(m.name).toBe('DiveDispatch')
    expect(m.short_name).toBe('DiveDispatch')
  })

  it('uses standalone display mode for native app feel', () => {
    expect(m.display).toBe('standalone')
  })

  it('starts at root', () => {
    expect(m.start_url).toBe('/')
  })

  it('includes required icon sizes for mobile installability', () => {
    const sizes = m.icons?.map((icon) => icon.sizes) ?? []
    // Android requires 192x192 and 512x512 for installability
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
  })

  it('sets theme and background colors', () => {
    expect(m.theme_color).toBeDefined()
    expect(m.background_color).toBeDefined()
  })

  it('has a description', () => {
    expect(m.description).toBeDefined()
    expect(m.description!.length).toBeGreaterThan(0)
  })

  it('icons have proper type declarations', () => {
    for (const icon of m.icons ?? []) {
      expect(icon.type).toBe('image/png')
    }
  })
})
