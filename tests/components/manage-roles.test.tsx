// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '../helpers/render'
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

interface MockRoleCompletion {
  role: ClerkRole
  percentage: number
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
    roleCompletions: [{ role: 'DiveCenter', percentage: 100 }] as MockRoleCompletion[],
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

  it('renders canonical percent badge copy for each role row', () => {
    render(
      <ManageRoles
        {...defaultProps}
        roles={[
          makeRole('Instructor', { profileComplete: false }),
          makeRole('DiveCenter', { profileComplete: true }),
          makeRole('Boat', { profileComplete: false }),
        ]}
        roleCompletions={[
          { role: 'Instructor', percentage: 0 },
          { role: 'DiveCenter', percentage: 100 },
          { role: 'Boat', percentage: 33 },
        ]}
      />,
    )
    expect(screen.getByText('Instructor')).toBeInTheDocument()
    expect(screen.getByText('Dive Center')).toBeInTheDocument()
    expect(screen.getByText('Boat')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('33%')).toBeInTheDocument()
    expect(screen.queryByText('Complete')).not.toBeInTheDocument()
    expect(screen.queryByText('Incomplete')).not.toBeInTheDocument()
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

  it('confirmation is hidden before clicking delete icon', () => {
    render(
      <ManageRoles
        {...defaultProps}
        roles={[
          makeRole('DiveCenter', { profileComplete: true }),
          makeRole('Boat', { profileComplete: false }),
        ]}
      />,
    )
    // Text exists in DOM (always rendered) but is not visible
    expect(screen.getByText(/delete dive center and all its data/i)).not.toBeVisible()
  })

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
    expect(screen.getByText(/delete dive center and all its data/i)).toBeVisible()
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
    // Text is back to hidden (always in DOM but not visible)
    expect(screen.getByText(/delete dive center and all its data/i)).not.toBeVisible()
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

  // ─── Loading and error states ─────────────────────────────────────────────

  it('disables "Delete permanently" button while delete is pending', async () => {
    const user = userEvent.setup()
    let resolveDelete!: () => void
    const onDeleteRole = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveDelete = resolve }),
    )
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

    const deletePermBtn = screen.getByRole('button', { name: /delete permanently/i })
    await user.click(deletePermBtn)

    // Button should be disabled while pending (GlassButton sets disabled when loading)
    expect(deletePermBtn).toBeDisabled()

    // Resolve the promise to clean up
    resolveDelete()
    await waitFor(() => {
      expect(deletePermBtn).not.toBeDisabled()
    })
  })

})
