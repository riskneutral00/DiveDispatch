// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '../helpers/render'
import { AddRoleModal } from '@/components/account/add-role-modal'
import { ROLES, type ClerkRole } from '@/lib/constants/roles'

// jsdom doesn't implement HTMLDialogElement methods
beforeEach(() => {
  HTMLDialogElement.prototype.show = vi.fn()
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})

// Stub role icons
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

describe('AddRoleModal', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    heldRoles: ['DiveCenter'] as ClerkRole[],
    onSelectRole: vi.fn(),
    loading: false,
    error: null as string | null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when closed', () => {
    render(<AddRoleModal {...defaultProps} open={false} />)
    expect(screen.queryByText('Add a Role')).toBeNull()
  })

  it('renders the dialog title when open', () => {
    render(<AddRoleModal {...defaultProps} />)
    expect(screen.getByText('Add a Role')).toBeInTheDocument()
  })

  it('does not show already-held roles in the grid', () => {
    render(<AddRoleModal {...defaultProps} heldRoles={['DiveCenter', 'Instructor']} />)
    // Held roles should NOT appear as aria-label buttons
    // Use hidden: true because <dialog> in jsdom doesn't expose content to a11y tree
    expect(screen.queryByRole('button', { name: /dive center/i, hidden: true })).toBeNull()
    expect(screen.queryByRole('button', { name: /^instructor$/i, hidden: true })).toBeNull()
    // But others should
    expect(screen.getByRole('button', { name: /^agent$/i, hidden: true })).toBeInTheDocument()
  })

  it('calls onSelectRole with the chosen role clerkRole', async () => {
    const onSelectRole = vi.fn()
    const user = userEvent.setup()
    render(<AddRoleModal {...defaultProps} onSelectRole={onSelectRole} />)

    await user.click(screen.getByRole('button', { name: /^agent$/i, hidden: true }))
    expect(onSelectRole).toHaveBeenCalledWith('Agent')
  })

  it('displays error message when error prop is set', () => {
    render(<AddRoleModal {...defaultProps} error="That role already exists." />)
    expect(screen.getByText('That role already exists.')).toBeInTheDocument()
  })

  it('shows no available roles message when all roles are held', () => {
    const allRoles = ROLES.map((r) => r.clerkRole)
    render(<AddRoleModal {...defaultProps} heldRoles={allRoles} />)
    expect(screen.getByText(/hold this role/i)).toBeInTheDocument()
  })

  it('disables role buttons when loading', () => {
    render(<AddRoleModal {...defaultProps} loading={true} />)
    const agentBtn = screen.getByRole('button', { name: /^agent$/i, hidden: true })
    expect(agentBtn).toBeDisabled()
  })
})
