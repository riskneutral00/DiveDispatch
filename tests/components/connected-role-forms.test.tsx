// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../helpers/render'

vi.mock('@/components/profiles/dive-center-profile-form', () => ({
  DiveCenterAffiliationsSection: () => <div data-testid="dive-center-associations" />,
}))

vi.mock('@/components/profiles/personal-profile-form', () => ({
  PersonalCredentialsSection: () => <div data-testid="instructor-credentials" />,
}))

vi.mock('@/components/profiles/boat-profile-form', () => ({
  BoatFleetSection: () => <div data-testid="boat-fleet" />,
}))

vi.mock('@/components/profiles/compressor-profile-form', () => ({
  CompressorGasMixesSection: () => <div data-testid="compressor-gas-mixes" />,
}))

vi.mock('@/components/profiles/agent-profile-form', () => ({
  AgentContactSection: () => <div data-testid="agent-contact" />,
  AgentAssociationsSection: () => <div data-testid="agent-associations" />,
}))

vi.mock('@/components/profiles/venue-capabilities-section', () => ({
  VenueCapabilitiesSection: () => <div data-testid="venue-capabilities" />,
}))

const { lastBusinessContactProps, mutationCalls } = vi.hoisted(() => ({
  lastBusinessContactProps: { current: null as Record<string, unknown> | null },
  mutationCalls: { all: [] as Array<{ args: unknown[] }> },
}))

// Default contact rendering for non-agent roles goes through BusinessContactSection.
// Capture props so the dispatcher's createOverride can be exercised from tests.
vi.mock('@/components/profiles/business-contact-section', () => ({
  BusinessContactSection: (props: Record<string, unknown>) => {
    lastBusinessContactProps.current = props
    return <div data-testid="business-contact" />
  },
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
    useMutation: () => {
      return (...args: unknown[]) => {
        mutationCalls.all.push({ args })
        return Promise.resolve('new-id')
      }
    },
  }
})

import { RoleProfileForm, hasConnectedForm } from '@/components/profiles/connected-role-forms'
import type { RoleKey } from '@/lib/constants/roles'

beforeEach(() => {
  vi.clearAllMocks()
  lastBusinessContactProps.current = null
  mutationCalls.all.length = 0
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
  it('renders the contact section for dive-center via BusinessContactSection (config-driven)', () => {
    render(<RoleProfileForm roleSlug="dive-center" />)
    expect(screen.getByTestId('business-contact')).toBeInTheDocument()
  })

  it('renders the associations section for dive-center', () => {
    render(<RoleProfileForm roleSlug="dive-center" section="associations" />)
    expect(screen.getByTestId('dive-center-associations')).toBeInTheDocument()
  })

  it('renders the credentials section for instructor', () => {
    render(<RoleProfileForm roleSlug="instructor" section="credentials" />)
    expect(screen.getByTestId('instructor-credentials')).toBeInTheDocument()
  })

  it('renders the contact section for agent (custom wrapper for referral note)', () => {
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

  it('defaults to the first profile tab when section is omitted (boat → contact via BusinessContactSection)', () => {
    render(<RoleProfileForm roleSlug="boat" />)
    expect(screen.getByTestId('business-contact')).toBeInTheDocument()
  })

  it('injects fleet: [] into boat create payload via dispatcher createOverride', async () => {
    render(<RoleProfileForm roleSlug="boat" />)
    expect(screen.getByTestId('business-contact')).toBeInTheDocument()

    const props = lastBusinessContactProps.current
    expect(props).not.toBeNull()
    const createOverride = props!.createOverride as
      | ((p: Record<string, unknown>) => Promise<unknown>)
      | undefined
    expect(createOverride, 'boat dispatcher must build a createOverride from RoleConfig.contact.payloadExtras.createDefaults').toBeDefined()

    await createOverride!({ name: 'Alpha Charters', email: 'ops@alpha.example', phone: '+10000000000' })

    expect(mutationCalls.all, 'createOverride must invoke exactly one mutation (api.boats.create)').toHaveLength(1)
    expect(mutationCalls.all[0].args[0]).toMatchObject({
      name: 'Alpha Charters',
      email: 'ops@alpha.example',
      phone: '+10000000000',
      fleet: [],
    })
  })

  it('does NOT inject createDefaults for roles whose payloadExtras has none (compressor)', async () => {
    render(<RoleProfileForm roleSlug="compressor" section="contact" />)
    expect(screen.getByTestId('business-contact')).toBeInTheDocument()

    const props = lastBusinessContactProps.current
    expect(props).not.toBeNull()
    expect(
      props!.createOverride,
      'compressor has no createDefaults; dispatcher must pass createOverride=undefined so BusinessContactSection uses raw create',
    ).toBeUndefined()
  })
})
