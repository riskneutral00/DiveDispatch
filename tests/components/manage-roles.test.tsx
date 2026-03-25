// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '../helpers/render'
import { ManageRoles } from '@/components/settings/manage-roles'
import type { ClerkRole } from '@/lib/constants/roles'

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
  _id: string
  role: ClerkRole
  isPrimary: boolean
  profileComplete: boolean
  createdAt: number
}

function makeRole(role: ClerkRole, opts: Partial<MockRole> = {}): MockRole {
  return {
    _id: `role_${role}`,
    role,
    isPrimary: false,
    profileComplete: false,
    createdAt: Date.now(),
    ...opts,
  }
}

describe('ManageRoles', () => {
  const defaultProps = {
    roles: [makeRole('DiveCenter', { isPrimary: true, profileComplete: true })],
    onAddRole: vi.fn(),
    onNavigateToOnboarding: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a heading for the section', () => {
    render(<ManageRoles {...defaultProps} />)
    expect(screen.getByText('Manage Roles')).toBeTruthy()
  })

  it('displays current roles with their labels', () => {
    render(<ManageRoles {...defaultProps} />)
    expect(screen.getByText('Dive Center')).toBeTruthy()
  })

  it('shows "Primary" badge on the primary role', () => {
    render(<ManageRoles {...defaultProps} />)
    expect(screen.getByText('Primary')).toBeTruthy()
  })

  it('shows completion status for each role', () => {
    render(
      <ManageRoles
        {...defaultProps}
        roles={[
          makeRole('DiveCenter', { isPrimary: true, profileComplete: true }),
          makeRole('Boat', { profileComplete: false }),
        ]}
      />,
    )
    expect(screen.getByText('Complete')).toBeTruthy()
    expect(screen.getByText('Incomplete')).toBeTruthy()
  })

  it('renders an "Add Role" button', () => {
    render(<ManageRoles {...defaultProps} />)
    expect(screen.getByRole('button', { name: /add role/i })).toBeTruthy()
  })

  it('shows multiple roles when user holds several', () => {
    render(
      <ManageRoles
        {...defaultProps}
        roles={[
          makeRole('DiveCenter', { isPrimary: true, profileComplete: true }),
          makeRole('Instructor', { profileComplete: false }),
          makeRole('Boat', { profileComplete: true }),
        ]}
      />,
    )
    expect(screen.getByText('Dive Center')).toBeTruthy()
    expect(screen.getByText('Instructor')).toBeTruthy()
    expect(screen.getByText('Boat')).toBeTruthy()
  })
})
