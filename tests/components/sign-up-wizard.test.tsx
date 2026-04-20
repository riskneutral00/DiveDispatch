// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../helpers/render'

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

const mockConvexAuth = vi.fn<() => { isLoading: boolean; isAuthenticated: boolean }>()
let mockUserMe: unknown = undefined
let mockUserRoles: unknown = undefined
let mockOrgRow: unknown = { _id: 'org_test', clerkOrgId: 'clerk_org_test', slug: 'sea-fun', name: 'Sea Fun', createdAt: 0, updatedAt: 0 }
let queryCallIndex = 0
const mockMutate = vi.fn()

// mock-ok: page-level render test; mocks useQuery/useMutation to drive UI states, not Convex behavior. Backend flows live in convex-test integration suites.
vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useConvexAuth: () => mockConvexAuth(),
    useQuery: (_query: unknown, args?: unknown) => {
      if (args === 'skip') return undefined
      if (args && typeof args === 'object' && args !== null && 'slug' in (args as object)) {
        return mockOrgRow
      }
      const idx = queryCallIndex++
      return idx % 2 === 0 ? mockUserMe : mockUserRoles
    },
    useMutation: () => mockMutate,
  }
})

let mockActiveOrg: { id: string; slug: string; name: string } | null = {
  id: 'org_test',
  slug: 'sea-fun',
  name: 'Sea Fun',
}
let mockOrgLoaded = true

vi.mock('@clerk/nextjs', () => ({
  SignUp: () => <div data-testid="clerk-signup">Clerk Sign Up</div>,
  useClerk: () => ({ signOut: vi.fn() }),
  useOrganization: () => ({ organization: mockActiveOrg, isLoaded: mockOrgLoaded }),
}))

vi.mock('@/components/icons/role-icons', () => {
  const stub = () => <svg data-testid="icon" />
  return {
    DiveCenterIcon: stub, AgentIcon: stub, LiveaboardIcon: stub,
    DiveResortIcon: stub, DiveHostelIcon: stub, DiveSiteIcon: stub,
    InstructorIcon: stub, DiveMasterIcon: stub, BoatIcon: stub,
    EquipmentIcon: stub, PoolIcon: stub, CompressorIcon: stub,
  }
})

vi.mock('@/components/profiles/language-picker', () => ({
  LanguagePicker: ({ disabled }: { disabled?: boolean }) => (
    <div data-testid="language-picker" data-disabled={disabled} />
  ),
}))

vi.mock('@/app/(auth)/clerk-glass-appearance', () => ({
  clerkGlassAppearance: {},
}))

import SignUpPage from '@/app/(auth)/sign-up/[[...sign-up]]/page'

beforeEach(() => {
  vi.clearAllMocks()
  queryCallIndex = 0
  mockUserMe = undefined
  mockUserRoles = undefined
  mockOrgRow = { _id: 'org_test', clerkOrgId: 'clerk_org_test', slug: 'sea-fun', name: 'Sea Fun', createdAt: 0, updatedAt: 0 }
  mockActiveOrg = { id: 'org_test', slug: 'sea-fun', name: 'Sea Fun' }
  mockOrgLoaded = true
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
      businessName: 'Deep Blue Diving',
      slug: 'deep-blue-diving',
    }
    mockUserRoles = [{ role: 'DiveCenter' }]

    render(<SignUpPage />)
    expect(mockReplace).toHaveBeenCalledWith('/deep-blue-diving/dive-center/dashboard')
    expect(mockReplace).not.toHaveBeenCalledWith('/dashboard')
  })

  it('redirects partial users (role set) straight to their role dashboard — no /onboarding or /dashboard detour', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockUserMe = {
      businessName: 'Mike Smith',
      slug: 'mike-smith',
    }
    mockUserRoles = [{ role: 'DiveCenter' }]

    render(<SignUpPage />)
    expect(mockReplace).toHaveBeenCalledWith('/mike-smith/dive-center/dashboard')
    expect(mockReplace).not.toHaveBeenCalledWith('/onboarding')
    expect(mockReplace).not.toHaveBeenCalledWith('/dashboard')
  })

  it('shows Redirecting… for any user with an existing record and synced org', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockUserMe = {
      businessName: 'Deep Blue Diving',
      slug: 'deep-blue-diving',
    }
    mockUserRoles = [{ role: 'DiveCenter' }]

    const { getByText } = render(<SignUpPage />)
    expect(getByText('Redirecting…')).toBeInTheDocument()
  })

  it('shows syncingOrganization spinner when orgRow has not landed yet', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockUserMe = { slug: 'deep-blue-diving' }
    mockUserRoles = [{ role: 'DiveCenter' }]
    mockOrgRow = null

    const { getByText } = render(<SignUpPage />)
    expect(getByText('Setting up your organization…')).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('shows noActiveOrg error when Clerk task did not set an active org', () => {
    mockConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    mockUserMe = { slug: 'deep-blue-diving' }
    mockUserRoles = [{ role: 'DiveCenter' }]
    mockActiveOrg = null
    mockOrgLoaded = true

    const { getByText } = render(<SignUpPage />)
    expect(getByText(/No active organization/)).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
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
