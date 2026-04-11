// @vitest-environment jsdom
/**
 * DD-262: Portal accessibility — fieldsets, aria-live, reduced motion
 *
 * Tests:
 * 1. Equipment step uses semantic <fieldset> + <legend> for measurement groups
 * 2. Validation error containers use aria-live="polite" (always rendered, content changes)
 * 3. globals.css includes universal prefers-reduced-motion override
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../helpers/render'
import { readGlobalsCssBundle } from '../helpers/globals-css-bundle'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: () => undefined,
    useMutation: () => vi.fn(),
  }
})

// ── Import after mocks ──────────────────────────────────────────────────────

import { StepEquipment } from '@/components/portal/step-equipment'

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DD-262: Equipment step semantic fieldsets', () => {
  const defaultProps = {
    onChange: vi.fn(),
    onComplete: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('wraps height inputs in a <fieldset> with a <legend>', () => {
    render(<StepEquipment {...defaultProps} />)

    const fieldsets = document.querySelectorAll('fieldset')
    const legends = Array.from(fieldsets).map((fs) => fs.querySelector('legend'))
    const legendTexts = legends
      .filter(Boolean)
      .map((l) => l!.textContent!.trim())

    expect(legendTexts).toContain('Height')
  })

  it('wraps weight inputs in a <fieldset> with a <legend>', () => {
    render(<StepEquipment {...defaultProps} />)

    const fieldsets = document.querySelectorAll('fieldset')
    const legends = Array.from(fieldsets).map((fs) => fs.querySelector('legend'))
    const legendTexts = legends
      .filter(Boolean)
      .map((l) => l!.textContent!.trim())

    expect(legendTexts).toContain('Weight')
  })

  it('wraps shoe size inputs in a <fieldset> with a <legend>', () => {
    render(<StepEquipment {...defaultProps} />)

    const fieldsets = document.querySelectorAll('fieldset')
    const legends = Array.from(fieldsets).map((fs) => fs.querySelector('legend'))
    const legendTexts = legends
      .filter(Boolean)
      .map((l) => l!.textContent!.trim())

    expect(legendTexts).toContain('Shoe Size')
  })

  it('fieldset legends are visually hidden with sr-only class', () => {
    render(<StepEquipment {...defaultProps} />)

    const fieldsets = document.querySelectorAll('fieldset')
    const legends = Array.from(fieldsets).flatMap((fs) =>
      Array.from(fs.querySelectorAll('legend')),
    )

    // All measurement legends should be sr-only
    const measurementLegends = legends.filter((l) =>
      ['Height', 'Weight', 'Shoe Size'].includes(l.textContent!.trim()),
    )
    expect(measurementLegends.length).toBe(3)

    for (const legend of measurementLegends) {
      expect(legend.classList.contains('sr-only')).toBe(true)
    }
  })

  it('fieldsets have no default border styling', () => {
    render(<StepEquipment {...defaultProps} />)

    const fieldsets = document.querySelectorAll('fieldset')
    // Measurement fieldsets should have border-none/p-0/m-0 to avoid default browser styling
    const measurementFieldsets = Array.from(fieldsets).filter((fs) => {
      const legend = fs.querySelector('legend')
      return legend && ['Height', 'Weight', 'Shoe Size'].includes(legend.textContent!.trim())
    })

    expect(measurementFieldsets.length).toBe(3)
    for (const fs of measurementFieldsets) {
      expect(fs.classList.contains('border-none')).toBe(true)
      expect(fs.classList.contains('p-0')).toBe(true)
      expect(fs.classList.contains('m-0')).toBe(true)
    }
  })
})

describe('DD-262: Equipment step validation error aria-live', () => {
  it('rental checklist error container has aria-live="polite"', () => {
    const onComplete = vi.fn()
    render(<StepEquipment onChange={vi.fn()} onComplete={onComplete} />)

    // Trigger validation by clicking Continue without filling rental items
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    // The error region should have aria-live="polite"
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeInTheDocument()
    expect(liveRegion!.textContent).toContain('Selection required for each item')
  })

  it('rental checklist error container is always rendered (not mount/unmount)', () => {
    const onComplete = vi.fn()
    const { container } = render(<StepEquipment onChange={vi.fn()} onComplete={onComplete} />)

    // Before validation: aria-live region should exist but be empty
    const liveRegionsBefore = container.querySelectorAll('[aria-live="polite"]')
    // There should be at least one live region for the rental checklist error
    const rentalRegion = Array.from(liveRegionsBefore).find(
      (el) => el.getAttribute('data-error-for') === 'rentalChecklist',
    )
    expect(rentalRegion).toBeInTheDocument()
    expect(rentalRegion!.textContent).toBe('')

    // After validation: same region should now have error text
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(rentalRegion!.textContent).toContain('Selection required for each item')
  })
})

describe('DD-262: globals.css prefers-reduced-motion universal override', () => {
  it('includes universal prefers-reduced-motion media query for all animations', () => {
    const css = readGlobalsCssBundle()

    // Should contain a universal reduced-motion block that targets all elements
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    // Should include the universal selector pattern (*, *::before, *::after)
    expect(css).toContain('animation-duration: 0.01ms !important')
    expect(css).toContain('transition-duration: 0.01ms !important')
    expect(css).toContain('animation-iteration-count: 1 !important')
    // Verify the universal selector is used (not just class-specific; may be formatted multi-line)
    expect(css).toContain('*::before')
    expect(css).toContain('*::after')
  })

  it('preserves existing glass-specific reduced motion rule', () => {
    const css = readGlobalsCssBundle()

    // The existing glass-specific rule should still be present
    expect(css).toContain('.glass,')
    expect(css).toContain('.glass-elevated,')
  })

  it('preserves dashboard-enter reduced motion rule', () => {
    const css = readGlobalsCssBundle()

    expect(css).toContain('.dashboard-enter')
    expect(css).toContain('animation: none')
  })
})
