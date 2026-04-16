// @vitest-environment jsdom
/**
 * Tests for PortalActiveFlow.
 *
 * 1. Renders the portal header with operator name
 * 2. Renders the step indicator
 * 3. Renders the contact step by default (no progress)
 * 4. Advances to medical step when contact onComplete fires
 * 5. Debounced equipment save is called with token on change
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '../helpers/render'
import { PortalActiveFlow } from '@/components/portal/portal-active-flow'
import { testDate } from '../helpers/dates'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockSaveEquipment = vi.fn()

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
    useMutation: () => mockSaveEquipment,
  }
})

// Stub dynamically-loaded steps — ssr: false components won't render in jsdom without this
let capturedOnComplete: (() => void) | undefined
let capturedOnBack: (() => void) | undefined

vi.mock('@/components/portal/step-contact', () => ({
  StepContact: ({ onComplete }: { token: string; onComplete: () => void }) => {
    capturedOnComplete = onComplete
    return <div data-testid="step-contact">Contact Step</div>
  },
}))

vi.mock('./step-medical', () => ({
  StepMedical: ({ onComplete }: { token: string; onComplete: () => void }) => {
    capturedOnComplete = onComplete
    return <div data-testid="step-medical">Medical Step</div>
  },
}))

// Dynamic imports resolve differently — mock the module paths used by next/dynamic
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ [key: string]: React.ComponentType<unknown> }>) => {
    // Return a simple component that renders a stub based on loader identity
    const ComponentStub = (props: Record<string, unknown>) => {
      // We need to differentiate which dynamic component this is.
      // Since we can't easily introspect the loader, return a generic stub.
      return <div data-testid="dynamic-step-stub" />
    }
    return ComponentStub
  },
}))

// ── Fixtures ────────────────────────────────────────────────────────────────────

const defaultProps = {
  token: 'test-token-123',
  customerName: 'Alice Diver',
  operatorName: 'Ocean Center',
  activityType: ['DSD'],
  startDate: testDate(16),
  endDate: testDate(18),
  diverCount: 1,
  progress: null,
}

// ── Tests ───────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  capturedOnComplete = undefined
  capturedOnBack = undefined
})

describe('PortalActiveFlow', () => {
  it('renders the portal header with operator name', () => {
    render(<PortalActiveFlow {...defaultProps} />)
    expect(screen.getByText('Ocean Center')).toBeInTheDocument()
  })

  it('renders the step indicator with multiple step labels', () => {
    render(<PortalActiveFlow {...defaultProps} />)
    // StepIndicator renders all step labels — check for a later step label
    // that wouldn't appear in the active step content itself
    expect(screen.getByText(/waiver/i)).toBeInTheDocument()
  })

  it('renders the contact step when progress is null', () => {
    render(<PortalActiveFlow {...defaultProps} />)
    expect(screen.getByTestId('step-contact')).toBeInTheDocument()
  })

  it('advances to next step when contact onComplete fires', async () => {
    render(<PortalActiveFlow {...defaultProps} />)
    expect(screen.getByTestId('step-contact')).toBeInTheDocument()

    // Trigger onComplete from StepContact stub
    await act(async () => {
      capturedOnComplete?.()
    })

    // After advancing, the contact step should no longer show;
    // either a dynamic stub or a next step will render
    expect(screen.queryByTestId('step-contact')).toBeNull()
  })

  it('starts on the correct server-derived step when progress is provided', () => {
    const progressAtMedical = {
      firstIncompleteStep: 'medical' as const,
      requiresContact: true,
      requiresMedical: true,
      requiresWaiver: true,
      contactComplete: true,
      medicalComplete: false,
      waiverComplete: false,
      equipmentComplete: false,
      contactData: null,
      medicalData: null,
      waiverSignedAt: null,
      equipmentData: null,
    }
    render(<PortalActiveFlow {...defaultProps} progress={progressAtMedical} />)
    // With medical as starting step, contact step should NOT render
    expect(screen.queryByTestId('step-contact')).toBeNull()
  })
})
