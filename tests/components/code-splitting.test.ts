// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * DD-160: Verify code splitting for heavy dashboard components.
 *
 * BookingWizard step components should be dynamically imported.
 */

const BOOKING_WIZARD = readFileSync(
  resolve(__dirname, '../../src/components/booking/booking-wizard.tsx'),
  'utf-8',
)

describe('DD-160: booking-wizard step code splitting', () => {
  it('keeps CustomerStep as a static import (first step)', () => {
    expect(BOOKING_WIZARD).toMatch(
      /^import\s+\{.*CustomerStep.*\}\s+from\s+/m,
    )
  })

  for (const name of ['ItineraryStep', 'ReviewStep']) {
    it(`does not statically import ${name}`, () => {
      const staticPattern = new RegExp(
        `^import\\s+\\{[^}]*${name}[^}]*\\}\\s+from\\s+`,
        'm',
      )
      expect(BOOKING_WIZARD).not.toMatch(staticPattern)
    })

    it(`loads ${name} via dynamic() with ssr: false`, () => {
      const block = BOOKING_WIZARD.match(
        new RegExp(`const\\s+${name}\\s*=\\s*dynamic\\([\\s\\S]*?\\n\\);?`, 'm'),
      )
      expect(block).not.toBeNull()
      expect(block![0]).toContain('ssr: false')
    })

    it(`shows Spinner as loading fallback for ${name}`, () => {
      const block = BOOKING_WIZARD.match(
        new RegExp(`const\\s+${name}\\s*=\\s*dynamic\\([\\s\\S]*?\\n\\);?`, 'm'),
      )
      expect(block).not.toBeNull()
      expect(block![0]).toMatch(/loading:\s*\(\)\s*=>\s*<Spinner\s*\/>/)
    })
  }

  it('imports next/dynamic', () => {
    expect(BOOKING_WIZARD).toMatch(/import\s+dynamic\s+from\s+['"]next\/dynamic['"]/)
  })
})
