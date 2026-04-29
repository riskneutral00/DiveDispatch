// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const PICKER = readFileSync(
  resolve(__dirname, '../../src/components/profiles/location-picker.tsx'),
  'utf-8',
)
const MODAL = readFileSync(
  resolve(__dirname, '../../src/components/profiles/location-picker-modal.tsx'),
  'utf-8',
)

describe('DD-224: LocationPicker trigger boundary', () => {
  it('location-picker.tsx imports next/dynamic', () => {
    expect(PICKER).toMatch(/import\s+dynamic\s+from\s+['"]next\/dynamic['"]/)
  })

  it('location-picker.tsx lazy-loads the modal with ssr: false', () => {
    const dynamicBlock = PICKER.match(
      /dynamic\([\s\S]*?['"]\.\/location-picker-modal['"][\s\S]*?ssr:\s*false/m,
    )
    expect(dynamicBlock).not.toBeNull()
  })

  it('location-picker.tsx uses loading: () => null (no spinner flash)', () => {
    expect(PICKER).toMatch(/loading:\s*\(\)\s*=>\s*null/)
  })

  it('location-picker.tsx exports the LocationValue type', () => {
    expect(PICKER).toMatch(/export\s+type\s+LocationValue/)
  })

  it('location-picker.tsx does NOT import the Maps SDK', () => {
    expect(PICKER).not.toMatch(/@vis\.gl\/react-google-maps/)
  })

  it('location-picker.tsx does NOT import places autocomplete', () => {
    expect(PICKER).not.toMatch(/use-places-autocomplete/)
  })

  it('location-picker.tsx does NOT import i18n-iso-countries', () => {
    expect(PICKER).not.toMatch(/i18n-iso-countries/)
  })
})

describe('DD-224: LocationPicker modal owns the heavy imports', () => {
  it('modal imports the Maps SDK', () => {
    expect(MODAL).toMatch(/@vis\.gl\/react-google-maps/)
  })

  it('modal imports places autocomplete', () => {
    expect(MODAL).toMatch(/use-places-autocomplete/)
  })

  it('modal imports i18n-iso-countries', () => {
    expect(MODAL).toMatch(/i18n-iso-countries/)
  })

  it('modal exports LocationPickerModal', () => {
    expect(MODAL).toMatch(/export\s+function\s+LocationPickerModal/)
  })
})

const CONSUMER_FILES = [
  'src/components/profiles/business-contact-section.tsx',
  'src/components/onboarding/organizer-basic-step.tsx',
  'src/components/profiles/profile-basic-info.tsx',
  'src/components/profiles/venue-edit-dialog.tsx',
]

describe('DD-224: consumers import from location-picker (not -lazy)', () => {
  for (const file of CONSUMER_FILES) {
    const shortName = file.split('/').pop()!

    it(`${shortName} imports from location-picker`, () => {
      const source = readFileSync(resolve(__dirname, '../../', file), 'utf-8')
      const lazyImport = /from\s+['"]@\/components\/profiles\/location-picker-lazy['"]/.test(source)
      expect(lazyImport, `${shortName} still imports from the deleted -lazy path`).toBe(false)

      const directImport = /from\s+['"]@\/components\/profiles\/location-picker['"]/.test(source)
      expect(directImport, `${shortName} should import from location-picker`).toBe(true)
    })
  }
})
