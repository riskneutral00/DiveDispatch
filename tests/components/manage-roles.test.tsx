// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '../helpers/render'
import { ManageRoles } from '@/components/account/manage-roles'
import type { ClerkRole } from '@/lib/constants/roles'
import type { Id } from '../../convex/_generated/dataModel'

// Stub role icons
vi.mock('@/lib/icons/role-icons', () => {
  const stub = (props: Record<string, unknown>) => <svg data-testid="role-icon" {...props} />
  return {
    DiveCenterIcon: stub,
    AgentIcon: stub,
    LiveaboardIcon: stub,
    DiveResortIcon: stub,
    DiveHostelIcon: stub,
    DiveSiteIcon: stub,
    InstructorIcon: stub,
    DiveMasterIcon: stub,
    BoatIcon: stub,
    EquipmentIcon: stub,
    PoolIcon: stub,
    CompressorIcon: stub,
  }
})

interface MockRole {
  _id: Id<'userRoles'>
  role: ClerkRole
  profileComplete: boolean
  createdAt: number
}

function makeRole(role: ClerkRole, opts: Partial<MockRole> = {}): MockRole {
  return {
    _id: `role_${role}` as Id<'userRoles'>,
    role,
    profileComplete: false,
    createdAt: Date.now(),
    ...opts,
  }
}

describe('ManageRoles', () => {
  const defaultProps = {
    roles: [makeRole('DiveCenter', { profileComplete: true })],
    onAddRole: vi.fn(),
    onNavigateToOnboarding: vi.fn(),
    onDeleteRole: vi.fn().mockResolvedValue(undefined),
    bookingCounts: {},
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a heading for the section', () => {
    render(<ManageRoles {...defaultProps} />)
    expect(screen.getByText('Manage Roles')).toBeInTheDocument()
  })

  it('displays current roles with their labels', () => {
    render(<ManageRoles {...defaultProps} />)
    expect(screen.getByText('Dive Center')).toBeInTheDocument()
  })

  it('shows "Primary" badge on the highest-precedence role when 2+ roles exist', () => {
    render(
      <ManageRoles
        {...defaultProps}
        roles={[
          makeRole('DiveCenter', { profileComplete: true }),
          makeRole('Boat', { profileComplete: false }),
        ]}
      />,
    )
    expect(screen.getByText('Primary')).toBeInTheDocument()
  })

  it('hides "Primary" badge when only 1 role exists', () => {
    render(<ManageRoles {...defaultProps} />)
    expect(screen.queryByText('Primary')).not.toBeInTheDocument()
  })

  it('shows completion status for each role', () => {
    render(
      <ManageRoles
        {...defaultProps}
        roles={[
          makeRole('DiveCenter', { profileComplete: true }),
          makeRole('Boat', { profileComplete: false }),
        ]}
      />,
    )
    expect(screen.getByText('Complete')).toBeInTheDocument()
    expect(screen.getByText('Incomplete')).toBeInTheDocument()
  })

  it('renders an "Add Role" button', () => {
    render(<ManageRoles {...defaultProps} />)
    expect(screen.getByRole('button', { name: /add role/i })).toBeInTheDocument()
  })

  it('shows multiple roles when user holds several', () => {
    render(
      <ManageRoles
        {...defaultProps}
        roles={[
          makeRole('DiveCenter', { profileComplete: true }),
          makeRole('Instructor', { profileComplete: false }),
          makeRole('Boat', { profileComplete: true }),
        ]}
      />,
    )
    expect(screen.getByText('Dive Center')).toBeInTheDocument()
    expect(screen.getByText('Instructor')).toBeInTheDocument()
    expect(screen.getByText('Boat')).toBeInTheDocument()
  })

  // ─── Delete icon visibility ────────────────────────────────────────────────

  it('hides delete icon when user has exactly 1 role', () => {
    render(<ManageRoles {...defaultProps} />)
    expect(screen.queryByRole('button', { name: /delete dive center role/i })).not.toBeInTheDocument()
  })

  it('shows delete icon on each role when user has 2+ roles', () => {
    render(
      <ManageRoles
        {...defaultProps}
        roles={[
          makeRole('DiveCenter', { profileComplete: true }),
          makeRole('Boat', { profileComplete: false }),
        ]}
      />,
    )
    expect(screen.getByRole('button', { name: /delete dive center role/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete boat role/i })).toBeInTheDocument()
  })

  it('disables delete icon and shows booking count hint when role has active bookings', () => {
    render(
      <ManageRoles
        {...defaultProps}
        roles={[
          makeRole('DiveCenter', { profileComplete: true }),
          makeRole('Instructor', { _id: 'role_Instructor' as Id<'userRoles'>, profileComplete: false }),
        ]}
        bookingCounts={{ role_Instructor: 3 }}
      />,
    )
    const deleteBtn = screen.getByRole('button', { name: /delete instructor role/i })
    expect(deleteBtn).toBeDisabled()
    expect(screen.getByText(/cannot delete — 3 active bookings/i)).toBeInTheDocument()
  })

  // ─── Inline confirmation flow ──────────────────────────────────────────────

  it('shows inline confirmation after clicking delete icon', async () => {
    const user = userEvent.setup()
    render(
      <ManageRoles
        {...defaultProps}
        roles={[
          makeRole('DiveCenter', { profileComplete: true }),
          makeRole('Boat', { profileComplete: false }),
        ]}
      />,
    )
    await user.click(screen.getByRole('button', { name: /delete dive center role/i }))
    expect(screen.getByText(/delete dive center and all its data/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete permanently/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('collapses confirmation on Cancel click', async () => {
    const user = userEvent.setup()
    render(
      <ManageRoles
        {...defaultProps}
        roles={[
          makeRole('DiveCenter', { profileComplete: true }),
          makeRole('Boat', { profileComplete: false }),
        ]}
      />,
    )
    await user.click(screen.getByRole('button', { name: /delete dive center role/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByText(/delete dive center and all its data/i)).not.toBeInTheDocument()
  })

  it('calls onDeleteRole when "Delete permanently" is clicked', async () => {
    const user = userEvent.setup()
    const onDeleteRole = vi.fn().mockResolvedValue(undefined)
    render(
      <ManageRoles
        {...defaultProps}
        roles={[
          makeRole('DiveCenter', { _id: 'role_DC' as Id<'userRoles'>, profileComplete: true }),
          makeRole('Boat', { profileComplete: false }),
        ]}
        onDeleteRole={onDeleteRole}
      />,
    )
    await user.click(screen.getByRole('button', { name: /delete dive center role/i }))
    await user.click(screen.getByRole('button', { name: /delete permanently/i }))
    expect(onDeleteRole).toHaveBeenCalledWith('role_DC')
  })
})
