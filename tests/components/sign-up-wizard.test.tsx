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
let mockUserMe: unknown = undefined
let mockUserRoles: unknown = undefined
let queryCallIndex = 0
const mockMutate = vi.fn()

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useConvexAuth: () => mockConvexAuth(),
    useQuery: () => {
      const idx = queryCallIndex++
      if (idx === 0) return mockUserMe
      return mockUserRoles
    },
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
vi.mock('@/components/profiles/language-picker', () => ({
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
  queryCallIndex = 0
  mockUserMe = undefined
  mockUserRoles = undefined
})

describe('Sign-up wizard (3-step: Clerk + Role + Profile)', () => {
  it('shows spinner while auth is loading', () => {
    mockConvexAuth.mockReturnValue({ isLoading: true, isAuthenticated: false })

    const { getByText } = render(<SignUpPage />)
    expect(getByText('Loading…')).toBeInTheDocument()
  })

  it('shows Clerk SignUp + 3-step indicator when not authenticated', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false })

    const { getByTestId, getByText } = render(<SignUpPage />)
    expect(getByTestId('clerk-signup')).toBeInTheDocument()
    expect(getByText('Sign Up')).toBeInTheDocument()
    expect(getByText('Role')).toBeInTheDocument()
    expect(getByText('Profile')).toBeInTheDocument()
  })

  it('does NOT show About You, Business, Preferences, Review steps in indicator', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false })

    const { queryByText } = render(<SignUpPage />)
    expect(queryByText('About You')).toBeNull()
    expect(queryByText('Business')).toBeNull()
    expect(queryByText('Preferences')).toBeNull()
    expect(queryByText('Review')).toBeNull()
  })

  it('shows spinner while waiting for Convex user query', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })

    const { getByText } = render(<SignUpPage />)
    expect(getByText('Loading…')).toBeInTheDocument()
  })

  it('shows Role selection step when authenticated with no Convex user', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockUserMe = null
    mockUserRoles = []

    const { getByText } = render(<SignUpPage />)
    expect(getByText("What's your role?")).toBeInTheDocument()
  })

  it('does NOT show resume prompt — role selection is shown directly', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockUserMe = null
    mockUserRoles = []

    const { queryByText } = render(<SignUpPage />)
    expect(queryByText('Sign up in progress')).toBeNull()
    expect(queryByText('Start over')).toBeNull()
  })

  it('redirects fully completed users straight to their role dashboard (skips /dashboard hop)', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockUserMe = {
      onboardingComplete: true,
      businessName: 'Deep Blue Diving',
      slug: 'deep-blue-diving',
    }
    mockUserRoles = [{ role: 'DiveCenter' }]

    render(<SignUpPage />)
    expect(mockReplace).toHaveBeenCalledWith('/deep-blue-diving/dive-center/dashboard')
    expect(mockReplace).not.toHaveBeenCalledWith('/dashboard')
  })

  it('redirects partial users (role set, onboarding not complete) straight to their role dashboard — no /onboarding or /dashboard detour', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockUserMe = {
      onboardingComplete: undefined,
      businessName: 'Mike Smith',
      slug: 'mike-smith',
    }
    mockUserRoles = [{ role: 'DiveCenter' }]

    render(<SignUpPage />)
    expect(mockReplace).toHaveBeenCalledWith('/mike-smith/dive-center/dashboard')
    expect(mockReplace).not.toHaveBeenCalledWith('/onboarding')
    expect(mockReplace).not.toHaveBeenCalledWith('/dashboard')
  })

  it('shows Redirecting… for any user with an existing record', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockUserMe = {
      onboardingComplete: true,
      businessName: 'Deep Blue Diving',
      slug: 'deep-blue-diving',
    }
    mockUserRoles = [{ role: 'DiveCenter' }]

    const { getByText } = render(<SignUpPage />)
    expect(getByText('Redirecting…')).toBeInTheDocument()
  })

  it('renders StepIndicator with 3 steps', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false })

    const { getByLabelText, getByText } = render(<SignUpPage />)
    const nav = getByLabelText('Progress')
    expect(nav).toBeInTheDocument()
    expect(getByText('Sign Up')).toBeInTheDocument()
    expect(getByText('Role')).toBeInTheDocument()
    expect(getByText('Profile')).toBeInTheDocument()
  })

  it('shows LanguageField above Clerk sign-up when unauthenticated', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false })

    const { getByTestId } = render(<SignUpPage />)
    expect(getByTestId('language-picker')).toBeInTheDocument()
    expect(getByTestId('clerk-signup')).toBeInTheDocument()
  })
})
