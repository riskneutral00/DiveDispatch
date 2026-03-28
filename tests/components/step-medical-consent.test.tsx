// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../helpers/render'

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useMutation: () => vi.fn(),
    useQuery: () => null,
  }
})

// ─── Import after mocks ─────────────────────────────────────────────────────
import { StepMedical } from '@/components/portal/step-medical'

describe('StepMedical — consent acknowledgment', () => {
  it('1 — displays consent text about data sharing with dive center', () => {
    render(<StepMedical token="test-token" onComplete={vi.fn()} />)
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/shared with your dive center/i)
  })

  it('2 — consent text references PADI medical standards', () => {
    render(<StepMedical token="test-token" onComplete={vi.fn()} />)
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/PADI medical standards/i)
  })

  it('3 — consent is informational only, not a blocking checkbox', () => {
    render(<StepMedical token="test-token" onComplete={vi.fn()} />)
    // There should be no consent checkbox — this is informational only
    const checkboxes = screen.queryAllByRole('checkbox')
    const consentCheckbox = checkboxes.filter((cb) =>
      cb.closest('[data-testid="consent-gate"]'),
    )
    expect(consentCheckbox).toHaveLength(0)
  })
})
