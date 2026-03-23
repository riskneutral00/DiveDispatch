// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../helpers/render'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

// Convex auth + query/mutation
const mockConvexAuth = vi.fn<() => { isLoading: boolean; isAuthenticated: boolean }>()
const mockQuery = vi.fn()
const mockMutate = vi.fn()

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useConvexAuth: () => mockConvexAuth(),
    useQuery: () => mockQuery(),
    useMutation: () => mockMutate,
  }
})

// Clerk
vi.mock('@clerk/nextjs', () => ({
  SignUp: () => <div data-testid="clerk-signup">Clerk Sign Up</div>,
  useClerk: () => ({ signOut: vi.fn() }),
}))

// Stub heavy children
vi.mock('@/components/icons/role-icons', () => {
  const stub = () => <svg data-testid="icon" />
  return {
    DiveCenterIcon: stub, AgentIcon: stub, LiveaboardIcon: stub,
    DiveResortIcon: stub, DiveHostelIcon: stub, DiveSiteIcon: stub,
    InstructorIcon: stub, DiveMasterIcon: stub, BoatIcon: stub,
    EquipmentIcon: stub, PoolIcon: stub, CompressorIcon: stub,
  }
})

// Stub LanguagePicker (depends on Convex useQuery)
vi.mock('@/components/common/language-picker', () => ({
  LanguagePicker: ({ disabled }: { disabled?: boolean }) => (
    <div data-testid="language-picker" data-disabled={disabled} />
  ),
}))

// Clerk glass appearance
vi.mock('@/app/(auth)/clerk-glass-appearance', () => ({
  clerkGlassAppearance: {},
}))

// ─── Import after mocks ──────────────────────────────────────────────────────
import SignUpPage from '@/app/(auth)/sign-up/[[...sign-up]]/page'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Sign-up wizard (2-step: Clerk + Role)', () => {
  it('shows spinner while auth is loading', () => {
    mockConvexAuth.mockReturnValue({ isLoading: true, isAuthenticated: false })
    mockQuery.mockReturnValue(undefined)

    const { getByText } = render(<SignUpPage />)
    expect(getByText('Loading…')).toBeInTheDocument()
  })

  it('shows Clerk SignUp + 2-step indicator when not authenticated', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false })
    mockQuery.mockReturnValue(undefined)

    const { getByTestId, getByText } = render(<SignUpPage />)
    expect(getByTestId('clerk-signup')).toBeInTheDocument()
    // 2-step indicator visible
    expect(getByText('Sign Up')).toBeInTheDocument()
    expect(getByText('Role')).toBeInTheDocument()
  })

  it('does NOT show About You, Business, Profile, Preferences, Review steps in indicator', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false })
    mockQuery.mockReturnValue(undefined)

    const { queryByText } = render(<SignUpPage />)
    expect(queryByText('About You')).toBeNull()
    expect(queryByText('Business')).toBeNull()
    expect(queryByText('Profile')).toBeNull()
    expect(queryByText('Preferences')).toBeNull()
    expect(queryByText('Review')).toBeNull()
  })

  it('shows spinner while waiting for Convex user query', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockQuery.mockReturnValue(undefined)

    const { getByText } = render(<SignUpPage />)
    expect(getByText('Loading…')).toBeInTheDocument()
  })

  it('shows Role selection step when authenticated with no Convex user', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockQuery.mockReturnValue(null) // no Convex user

    const { getByText } = render(<SignUpPage />)
    expect(getByText("What's your role?")).toBeInTheDocument()
  })

  it('does NOT show resume prompt — role selection is shown directly', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockQuery.mockReturnValue(null) // no Convex user

    const { queryByText } = render(<SignUpPage />)
    expect(queryByText('Sign up in progress')).toBeNull()
    expect(queryByText('Start over')).toBeNull()
  })

  it('redirects fully completed users to dashboard', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockQuery.mockReturnValue({
      onboardingComplete: true,
      businessName: 'Deep Blue Diving',
      role: 'DiveCenter',
      slug: 'deep-blue-diving',
    })

    render(<SignUpPage />)

    expect(mockReplace).toHaveBeenCalledWith('/deep-blue-diving/dive-center')
  })

  it('redirects partial users (role set, onboarding not complete) to dashboard — no /onboarding detour', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockQuery.mockReturnValue({
      onboardingComplete: undefined,
      businessName: 'Mike Smith',
      role: 'DiveCenter',
      slug: 'mike-smith',
    })

    render(<SignUpPage />)

    expect(mockReplace).toHaveBeenCalledWith('/mike-smith/dive-center')
    expect(mockReplace).not.toHaveBeenCalledWith('/onboarding')
  })

  it('shows Redirecting… for any user with an existing record', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockQuery.mockReturnValue({
      onboardingComplete: true,
      businessName: 'Deep Blue Diving',
      role: 'DiveCenter',
      slug: 'deep-blue-diving',
    })

    const { getByText } = render(<SignUpPage />)
    expect(getByText('Redirecting…')).toBeInTheDocument()
  })

  it('renders StepIndicator with 2 steps', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false })
    mockQuery.mockReturnValue(undefined)

    const { getByLabelText } = render(<SignUpPage />)
    const nav = getByLabelText('Progress')
    expect(nav).toBeInTheDocument()
  })
})
