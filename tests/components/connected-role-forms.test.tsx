// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../helpers/render'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Stub all profile form components to avoid transitive complexity.
// Each stub renders a sentinel that we can query by data-testid.
vi.mock('@/components/profiles/dive-center-profile-form', () => ({
  DiveCenterProfileForm: (props: Record<string, unknown>) => (
    <div data-testid="dive-center-form" data-section={props.section as string} />
  ),
}))

vi.mock('@/components/profiles/personal-profile-form', () => ({
  InstructorProfileForm: (props: Record<string, unknown>) => (
    <div data-testid="instructor-form" data-section={props.section as string} />
  ),
}))

vi.mock('@/components/profiles/boat-profile-form', () => ({
  BoatProfileForm: (props: Record<string, unknown>) => (
    <div data-testid="boat-form" data-section={props.section as string} />
  ),
}))

vi.mock('@/components/profiles/compressor-profile-form', () => ({
  CompressorProfileForm: (props: Record<string, unknown>) => (
    <div data-testid="compressor-form" data-section={props.section as string} />
  ),
}))

vi.mock('@/components/profiles/equipment-profile-form', () => ({
  EquipmentProfileForm: (props: Record<string, unknown>) => (
    <div data-testid="equipment-form" data-section={props.section as string} />
  ),
}))

vi.mock('@/components/profiles/agent-profile-form', () => ({
  AgentProfileForm: (props: Record<string, unknown>) => (
    <div data-testid="agent-form" data-section={props.section as string} />
  ),
}))

// Convex mocks — profile query + mutations
// NOTE: vi.mock is hoisted, so we cannot reference module-level variables here.
// useMutation returns a fresh vi.fn() each call.
vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: () => null, // profile = null (no existing profile)
    useMutation: () => vi.fn().mockResolvedValue(undefined),
  }
})

// ─── Import after mocks ──────────────────────────────────────────────────────

import { RoleProfileForm, hasConnectedForm } from '@/components/profiles/connected-role-forms'
import type { RoleKey } from '@/lib/constants/roles'

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('hasConnectedForm', () => {
  it('returns true for known role keys', () => {
    expect(hasConnectedForm('dive-center' as RoleKey)).toBe(true)
    expect(hasConnectedForm('instructor' as RoleKey)).toBe(true)
    expect(hasConnectedForm('agent' as RoleKey)).toBe(true)
  })

  it('returns false for unknown role keys', () => {
    expect(hasConnectedForm('unknown-role' as RoleKey)).toBe(false)
  })
})

describe('RoleProfileForm', () => {
  it('renders DiveCenterProfileForm for dive-center role', () => {
    render(<RoleProfileForm roleSlug="dive-center" />)
    expect(screen.getByTestId('dive-center-form')).toBeInTheDocument()
  })

  it('renders InstructorProfileForm for instructor role', () => {
    render(<RoleProfileForm roleSlug="instructor" />)
    expect(screen.getByTestId('instructor-form')).toBeInTheDocument()
  })

  it('renders AgentProfileForm for agent role', () => {
    render(<RoleProfileForm roleSlug="agent" />)
    expect(screen.getByTestId('agent-form')).toBeInTheDocument()
  })

  it('renders nothing for an unrecognized role', () => {
    const { container } = render(<RoleProfileForm roleSlug={'unknown-role' as RoleKey} />)
    expect(container.firstChild).toBeNull()
  })

  it('passes section prop down to the profile form', () => {
    render(<RoleProfileForm roleSlug="dive-center" section="contact" />)
    const form = screen.getByTestId('dive-center-form')
    expect(form).toHaveAttribute('data-section', 'contact')
  })
})
