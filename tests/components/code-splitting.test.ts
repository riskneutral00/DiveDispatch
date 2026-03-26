// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * DD-160: Verify code splitting for heavy dashboard components.
 *
 * Non-organizer users should not download @dnd-kit/core.
 * BookingWizard step components should be dynamically imported.
 */

const DASHBOARD_CONTENT = readFileSync(
  resolve(__dirname, '../../src/components/dashboard/dashboard-content.tsx'),
  'utf-8',
)

const BOOKING_CALENDAR = readFileSync(
  resolve(__dirname, '../../src/components/booking/booking-calendar.tsx'),
  'utf-8',
)

const BOOKING_WIZARD = readFileSync(
  resolve(__dirname, '../../src/components/booking/booking-wizard.tsx'),
  'utf-8',
)

describe('DD-160: dashboard-content dnd-kit code splitting', () => {
  it('does not statically import DndContext from @dnd-kit/core', () => {
    expect(DASHBOARD_CONTENT).not.toMatch(
      /^import\s+\{[^}]*DndContext[^}]*\}\s+from\s+['"]@dnd-kit\/core['"]/m,
    )
  })

  it('does not statically import DragOverlay from @dnd-kit/core', () => {
    expect(DASHBOARD_CONTENT).not.toMatch(
      /^import\s+\{[^}]*DragOverlay[^}]*\}\s+from\s+['"]@dnd-kit\/core['"]/m,
    )
  })

  it('imports next/dynamic', () => {
    expect(DASHBOARD_CONTENT).toMatch(/import\s+dynamic\s+from\s+['"]next\/dynamic['"]/)
  })

  it('loads DndCalendarWrapper via dynamic() with ssr: false', () => {
    const block = DASHBOARD_CONTENT.match(
      /const\s+DndCalendarWrapper\s*=\s*dynamic\([\s\S]*?\n\)/m,
    )
    expect(block).not.toBeNull()
    expect(block![0]).toContain('ssr: false')
    expect(block![0]).toContain('dnd-calendar-wrapper')
  })
})

describe('DD-160: booking-calendar dnd-kit code splitting', () => {
  it('does not statically import useDroppable from @dnd-kit/core', () => {
    expect(BOOKING_CALENDAR).not.toMatch(
      /^import\s+\{[^}]*useDroppable[^}]*\}\s+from\s+['"]@dnd-kit\/core['"]/m,
    )
  })

  it('imports next/dynamic', () => {
    expect(BOOKING_CALENDAR).toMatch(/import\s+dynamic\s+from\s+['"]next\/dynamic['"]/)
  })

  it('loads DroppableDateCell via dynamic() with ssr: false', () => {
    const block = BOOKING_CALENDAR.match(
      /const\s+DroppableDateCell\s*=\s*dynamic\([\s\S]*?\n\)/m,
    )
    expect(block).not.toBeNull()
    expect(block![0]).toContain('ssr: false')
    expect(block![0]).toContain('droppable-date-cell')
  })
})

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
