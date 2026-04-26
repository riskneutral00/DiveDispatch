// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../helpers/render'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Stub role icons used transitively by ManageRoles and AddRoleModal
vi.mock('@/lib/icons/role-icons', () => {
  const stub = (props: Record<string, unknown>) => <svg data-testid="role-icon" {...props} />
  return {
    DiveCenterIcon: stub,
    AgentIcon: stub,
    DiveSiteIcon: stub,
    InstructorIcon: stub,
    DiveMasterIcon: stub,
    BoatIcon: stub,
    EquipmentIcon: stub,
    PoolIcon: stub,
    CompressorIcon: stub,
  }
})

// jsdom doesn't implement HTMLDialogElement methods
beforeEach(() => {
  HTMLDialogElement.prototype.show = vi.fn()
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})

// Stub RoleOnboarding to avoid transitive complexity
vi.mock('@/components/account/role-onboarding', () => ({
  RoleOnboarding: ({ role, onComplete }: { role: string; onComplete: () => void }) => (
    <div data-testid="role-onboarding" data-role={role}>
      <button onClick={onComplete}>Complete onboarding</button>
    </div>
  ),
}))

// Convex mocks — we track state via module-level lets (not const, to avoid TDZ in hoisted factory).
// The mock factory closes over these at call time, so mutations per-test are safe.
let mockRoles: unknown = []
let mockBookingCounts: unknown = {}
let mockRoleCompleteness: unknown = { roles: [] }
// These are assigned in beforeEach and referenced by the factory at call time.
let _addRoleFn: ReturnType<typeof vi.fn>
let _deleteRoleFn: ReturnType<typeof vi.fn>
let _mutIdx = 0
let _qIdx = 0

vi.mock('@/lib/hooks/use-session-identity', () => ({
  useSessionIdentity: () => ({
    user: null,
    roles: mockRoles,
    defaultRole: null,
    defaultRoleKey: null,
    slug: null,
    status: 'ready',
    isAuthLoading: false,
    isAuthenticated: false,
  }),
}))

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: () => {
      if (_qIdx >= 2) _qIdx = 0
      const idx = _qIdx++
      if (idx === 0) return mockBookingCounts
      return mockRoleCompleteness
    },
    useMutation: () => {
      // useMutation is called twice per render (addRole at idx 0, deleteRole at idx 1).
      // Use modulo so that re-renders return the correct fn regardless of render count.
      const idx = _mutIdx++ % 2
      return idx === 0 ? _addRoleFn : _deleteRoleFn
    },
  }
})

// ─── Import after mocks ──────────────────────────────────────────────────────

import { ManageRolesConnected } from '@/components/account/manage-roles-connected'

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  _qIdx = 0
  _mutIdx = 0
  mockRoles = []
  mockBookingCounts = {}
  mockRoleCompleteness = { roles: [] }
  _addRoleFn = vi.fn().mockResolvedValue(undefined)
  _deleteRoleFn = vi.fn().mockResolvedValue(undefined)
})

describe('ManageRolesConnected', () => {
  it('shows spinner while queries are loading', () => {
    mockRoles = undefined
    mockBookingCounts = undefined
    mockRoleCompleteness = undefined

    const { container } = render(<ManageRolesConnected />)
    // Spinner renders (animate-spin class) — ManageRoles section heading not yet visible
    expect(container.querySelector('.animate-spin')).toBeTruthy()
    expect(screen.queryByText('Manage Roles')).not.toBeInTheDocument()
  })

  it('renders ManageRoles section heading once data loads', () => {
    mockBookingCounts = {}
    mockRoleCompleteness = { roles: [{ role: 'DiveCenter', percentage: 100 }] }

    render(<ManageRolesConnected />)

    expect(screen.getByText('Manage Roles')).toBeInTheDocument()
  })

  it('renders the Add Role button when data is loaded', () => {
    mockBookingCounts = {}
    mockRoleCompleteness = { roles: [] }

    render(<ManageRolesConnected />)

    expect(screen.getByRole('button', { name: /add role/i })).toBeInTheDocument()
  })

  it('shows RoleOnboarding immediately after a successful addRole mutation', async () => {
    mockBookingCounts = {}
    mockRoleCompleteness = { roles: [{ role: 'DiveCenter', percentage: 100 }] }

    const userEvent = (await import('@testing-library/user-event')).default.setup()
    const { waitFor } = await import('@testing-library/react')

    render(<ManageRolesConnected />)

    // Open the AddRoleModal
    await userEvent.click(screen.getByRole('button', { name: /add role/i }))

    // Select Agent (not yet held)
    const agentBtn = screen.getByRole('button', { name: /^agent$/i, hidden: true })
    await userEvent.click(agentBtn)

    expect(_addRoleFn).toHaveBeenCalledWith({ role: 'Agent' })

    // After resolution, RoleOnboarding should appear
    await waitFor(() => {
      expect(screen.getByTestId('role-onboarding')).toBeInTheDocument()
    })
  })

  it('displays error when addRole throws DUPLICATE_ROLE', async () => {
    mockBookingCounts = {}
    mockRoleCompleteness = { roles: [] }

    const { ConvexError } = await import('convex/values')
    _addRoleFn.mockRejectedValue(new ConvexError({ code: 'DUPLICATE_ROLE' }))

    const userEvent = (await import('@testing-library/user-event')).default.setup()
    const { waitFor } = await import('@testing-library/react')

    render(<ManageRolesConnected />)
    await userEvent.click(screen.getByRole('button', { name: /add role/i }))

    const agentBtn = screen.getByRole('button', { name: /^agent$/i, hidden: true })
    await userEvent.click(agentBtn)

    await waitFor(() => {
      // en.json: errors.duplicateRole = "You already hold this role."
      expect(screen.getByText(/already hold this role/i)).toBeInTheDocument()
    })
  })
})
