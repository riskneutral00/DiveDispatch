// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../helpers/render'

vi.mock('@/components/profiles/dive-center-profile-form', () => ({
  DiveCenterContactSection: () => <div data-testid="dive-center-contact" />,
  DiveCenterAffiliationsSection: () => <div data-testid="dive-center-associations" />,
}))

vi.mock('@/components/profiles/personal-profile-form', () => ({
  PersonalContactSection: () => <div data-testid="instructor-contact" />,
  PersonalCredentialsSection: () => <div data-testid="instructor-credentials" />,
}))

vi.mock('@/components/profiles/boat-profile-form', () => ({
  BoatContactSection: () => <div data-testid="boat-contact" />,
  BoatFleetSection: () => <div data-testid="boat-fleet" />,
}))

vi.mock('@/components/profiles/compressor-profile-form', () => ({
  CompressorGasMixesSection: () => <div data-testid="compressor-gas-mixes" />,
}))

vi.mock('@/components/profiles/equipment-profile-form', () => ({
  EquipmentContactSection: () => <div data-testid="equipment-contact" />,
}))

vi.mock('@/components/profiles/agent-profile-form', () => ({
  AgentContactSection: () => <div data-testid="agent-contact" />,
  AgentAssociationsSection: () => <div data-testid="agent-associations" />,
}))

vi.mock('@/components/profiles/venue-capabilities-section', () => ({
  VenueCapabilitiesSection: () => <div data-testid="venue-capabilities" />,
}))

// mock-ok: frontend RoleProfileForm dispatch test; stubs Convex hooks because we're asserting React routing, not DB behavior. Sections are independently mocked above.
vi.mock('@/lib/hooks/use-session-identity', () => ({
  useSessionIdentity: () => ({
    user: null,
    roles: undefined,
    defaultRole: null,
    defaultRoleKey: null,
    slug: null,
    status: 'loading',
    isAuthLoading: false,
    isAuthenticated: false,
  }),
}))

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: () => null,
    useMutation: () => vi.fn().mockResolvedValue(undefined),
  }
})

import { RoleProfileForm, hasConnectedForm } from '@/components/profiles/connected-role-forms'
import type { RoleKey } from '@/lib/constants/roles'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('hasConnectedForm', () => {
  it('returns true for known role keys', () => {
    expect(hasConnectedForm('dive-center' as RoleKey)).toBe(true)
    expect(hasConnectedForm('instructor' as RoleKey)).toBe(true)
    expect(hasConnectedForm('agent' as RoleKey)).toBe(true)
    expect(hasConnectedForm('boat' as RoleKey)).toBe(true)
    expect(hasConnectedForm('compressor' as RoleKey)).toBe(true)
    expect(hasConnectedForm('equipment' as RoleKey)).toBe(true)
    expect(hasConnectedForm('venue' as RoleKey)).toBe(true)
  })

  it('returns false for unknown role keys', () => {
    expect(hasConnectedForm('unknown-role' as RoleKey)).toBe(false)
  })
})

describe('RoleProfileForm', () => {
  it('renders the contact section for dive-center when no section is specified', () => {
    render(<RoleProfileForm roleSlug="dive-center" />)
    expect(screen.getByTestId('dive-center-contact')).toBeInTheDocument()
  })

  it('renders the associations section for dive-center', () => {
    render(<RoleProfileForm roleSlug="dive-center" section="associations" />)
    expect(screen.getByTestId('dive-center-associations')).toBeInTheDocument()
  })

  it('renders the credentials section for instructor', () => {
    render(<RoleProfileForm roleSlug="instructor" section="credentials" />)
    expect(screen.getByTestId('instructor-credentials')).toBeInTheDocument()
  })

  it('renders the contact section for agent', () => {
    render(<RoleProfileForm roleSlug="agent" section="contact" />)
    expect(screen.getByTestId('agent-contact')).toBeInTheDocument()
  })

  it('renders nothing for an unrecognized role', () => {
    const { container } = render(<RoleProfileForm roleSlug={'unknown-role' as RoleKey} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when an unknown section is requested', () => {
    const { container } = render(<RoleProfileForm roleSlug="boat" section="not-a-real-section" />)
    expect(container.firstChild).toBeNull()
  })

  it('defaults to the first registered section when section is omitted', () => {
    render(<RoleProfileForm roleSlug="boat" />)
    expect(screen.getByTestId('boat-contact')).toBeInTheDocument()
  })
})
