// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../helpers/render'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

const mockConvexAuth = vi.fn<() => { isLoading: boolean; isAuthenticated: boolean }>()

// The sign-in page calls useQuery twice: users.me then userRoles.myRoles
// Track by call index per render
let queryCallIndex = 0
let mockUserMe: unknown = undefined
let mockUserRoles: unknown = undefined

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
    useMutation: () => vi.fn(),
  }
})

vi.mock('@clerk/nextjs', () => ({
  SignIn: () => <div data-testid="clerk-signin">Clerk Sign In</div>,
  useClerk: () => ({ signOut: vi.fn() }),
}))

vi.mock('@/app/(auth)/clerk-glass-appearance', () => ({
  clerkGlassAppearance: {},
}))

// ─── Import after mocks ──────────────────────────────────────────────────────
import SignInPage from '@/app/(auth)/sign-in/[[...sign-in]]/page'

beforeEach(() => {
  vi.clearAllMocks()
  queryCallIndex = 0
  mockUserMe = undefined
  mockUserRoles = undefined
})

describe('Sign-in page routing', () => {
  it('shows spinner while loading', () => {
    mockConvexAuth.mockReturnValue({ isLoading: true, isAuthenticated: false })

    const { getByText } = render(<SignInPage />)
    expect(getByText('Loading…')).toBeInTheDocument()
  })

  it('shows Clerk SignIn form when not authenticated', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false })

    const { getByTestId } = render(<SignInPage />)
    expect(getByTestId('clerk-signin')).toBeInTheDocument()
  })

  it('redirects completed user to dashboard', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockUserMe = {
      onboardingComplete: true,
      slug: 'deep-blue',
      businessName: 'Deep Blue',
    }
    mockUserRoles = [{ role: 'DiveCenter' }]

    const { getByText } = render(<SignInPage />)
    expect(mockReplace).toHaveBeenCalledWith('/deep-blue/dive-center')
    expect(getByText('Redirecting…')).toBeInTheDocument()
  })

  it('redirects partial user (record exists, onboarding not complete) directly to dashboard — no /onboarding', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockUserMe = {
      onboardingComplete: undefined,
      slug: 'partial-user',
      businessName: 'Mike Smith',
    }
    mockUserRoles = [{ role: 'DiveCenter' }]

    render(<SignInPage />)
    expect(mockReplace).toHaveBeenCalledWith('/partial-user/dive-center')
    expect(mockReplace).not.toHaveBeenCalledWith('/onboarding')
  })

  it('redirects authenticated user with no Convex record to /sign-up', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockUserMe = null
    mockUserRoles = []

    const { getByText } = render(<SignInPage />)
    expect(mockReplace).toHaveBeenCalledWith('/sign-up')
    expect(getByText('Redirecting…')).toBeInTheDocument()
  })

  it('shows spinner while Convex query is loading', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })

    const { getByText } = render(<SignInPage />)
    expect(getByText('Loading…')).toBeInTheDocument()
  })

  it('never shows "Sign up in progress" interstitial on sign-in page', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockUserMe = null
    mockUserRoles = []

    const { queryByText } = render(<SignInPage />)
    expect(queryByText('Sign up in progress')).toBeNull()
  })
})
