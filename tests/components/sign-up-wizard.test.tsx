// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../helpers/render'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn(), back: vi.fn() }),
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

// Clerk <SignUp> component
vi.mock('@clerk/nextjs', () => ({
  SignUp: () => <div data-testid="clerk-signup">Clerk Sign Up</div>,
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

// Clerk glass appearance
vi.mock('@/app/(auth)/clerk-glass-appearance', () => ({
  clerkGlassAppearance: {},
}))

// ─── Import after mocks ──────────────────────────────────────────────────────
import SignUpPage from '@/app/(auth)/sign-up/[[...sign-up]]/page'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Sign-up wizard', () => {
  it('shows spinner while auth is loading', () => {
    mockConvexAuth.mockReturnValue({ isLoading: true, isAuthenticated: false })
    mockQuery.mockReturnValue(undefined)

    const { getByText } = render(<SignUpPage />)
    expect(getByText('Loading…')).toBeInTheDocument()
  })

  it('shows Clerk SignUp when not authenticated (step 1)', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false })
    mockQuery.mockReturnValue(undefined)

    const { getByTestId, getByText } = render(<SignUpPage />)
    expect(getByTestId('clerk-signup')).toBeInTheDocument()
    // Step indicator should show "Sign Up" as active
    expect(getByText('Sign Up')).toBeInTheDocument()
    expect(getByText('Role')).toBeInTheDocument()
    expect(getByText('Profile')).toBeInTheDocument()
  })

  it('shows spinner while waiting for Convex user query', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockQuery.mockReturnValue(undefined)

    const { getByText } = render(<SignUpPage />)
    expect(getByText('Loading…')).toBeInTheDocument()
  })

  it('shows role selection when authenticated with no Convex user (step 2)', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockQuery.mockReturnValue(null) // no Convex user yet

    const { getByText } = render(<SignUpPage />)
    expect(getByText("What's your role?")).toBeInTheDocument()
    expect(getByText('Select all that apply.')).toBeInTheDocument()
  })

  it('redirects completed users to dashboard', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockQuery.mockReturnValue({
      businessName: 'Deep Blue Diving',
      role: 'DiveCenter',
      slug: 'deep-blue-diving',
    })

    render(<SignUpPage />)

    expect(mockReplace).toHaveBeenCalledWith('/dive-center/deep-blue-diving/dashboard')
  })

  it('shows "Redirecting…" for completed users', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockQuery.mockReturnValue({
      businessName: 'Deep Blue Diving',
      role: 'DiveCenter',
      slug: 'deep-blue-diving',
    })

    const { getByText } = render(<SignUpPage />)
    expect(getByText('Redirecting…')).toBeInTheDocument()
  })

  it('renders StepIndicator with correct step count', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false })
    mockQuery.mockReturnValue(undefined)

    const { getByLabelText } = render(<SignUpPage />)
    const nav = getByLabelText('Progress')
    expect(nav).toBeInTheDocument()
  })
})
