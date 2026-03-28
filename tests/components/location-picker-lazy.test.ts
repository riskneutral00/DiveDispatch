// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * DD-224: Verify LocationPicker is lazy-loaded via next/dynamic.
 *
 * The Google Maps SDK (~200KB) should only load when the location picker
 * modal opens, not eagerly on every page that imports LocationPicker.
 */

const LAZY_WRAPPER = readFileSync(
  resolve(__dirname, '../../src/components/common/location-picker-lazy.tsx'),
  'utf-8',
)

describe('DD-224: LocationPicker lazy wrapper', () => {
  it('imports next/dynamic', () => {
    expect(LAZY_WRAPPER).toMatch(/import\s+dynamic\s+from\s+['"]next\/dynamic['"]/)
  })

  it('wraps LocationPicker with dynamic() and ssr: false', () => {
    const dynamicBlock = LAZY_WRAPPER.match(
      /dynamic\([\s\S]*?['"]\.\/location-picker['"][\s\S]*?ssr:\s*false/m,
    )
    expect(dynamicBlock).not.toBeNull()
  })

  it('shows Spinner as loading fallback', () => {
    expect(LAZY_WRAPPER).toMatch(/loading:\s*\(\)\s*=>\s*<Spinner\s*\/>/)
  })

  it('re-exports LocationValue type', () => {
    expect(LAZY_WRAPPER).toMatch(/export\s+.*type\s+.*LocationValue/)
  })
})

/**
 * DD-224: Verify all consumer files import from the lazy wrapper,
 * not directly from location-picker.tsx.
 */
const CONSUMER_FILES = [
  'src/components/dashboard/equipment-profile-form.tsx',
  'src/components/dashboard/boat-profile-form.tsx',
  'src/components/dashboard/instructor-profile-form.tsx',
  'src/components/dashboard/divemaster-profile-form.tsx',
  'src/components/dashboard/compressor-profile-form.tsx',
  'src/components/dashboard/pool-profile-form.tsx',
  'src/components/dashboard/dive-center-profile-form.tsx',
  'src/components/dashboard/organizer-basic-step.tsx',
  'src/components/dashboard/agent-profile-form.tsx',
  'src/components/common/profile-form.tsx',
  'src/components/common/profile-basic-info.tsx',
]

describe('DD-224: consumers import from lazy wrapper', () => {
  for (const file of CONSUMER_FILES) {
    const shortName = file.split('/').pop()!

    it(`${shortName} imports from location-picker-lazy`, () => {
      const source = readFileSync(resolve(__dirname, '../../', file), 'utf-8')
      // Should NOT import directly from location-picker (without -lazy)
      const directImport = /from\s+['"]@\/components\/common\/location-picker['"]/.test(source)
      expect(directImport, `${shortName} still imports directly from location-picker`).toBe(false)
    })

    it(`${shortName} imports from the lazy path`, () => {
      const source = readFileSync(resolve(__dirname, '../../', file), 'utf-8')
      const lazyImport = /from\s+['"]@\/components\/common\/location-picker-lazy['"]/.test(source)
      expect(lazyImport, `${shortName} should import from location-picker-lazy`).toBe(true)
    })
  }
})
