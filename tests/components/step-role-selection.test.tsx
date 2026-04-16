// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render } from '../helpers/render'
import { StepRoleSelection } from '@/components/onboarding/step-role-selection'
import { ORGANIZER_ROLES, RESOURCE_ROLES } from '@/lib/constants/roles'

// Stub all role icons — they import SVG components that jsdom can't handle
vi.mock('@/components/icons/role-icons', () => {
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

describe('StepRoleSelection', () => {
  const defaultProps = {
    selectedRoles: [] as typeof ORGANIZER_ROLES,
    onToggle: vi.fn(),
    onContinue: vi.fn(),
  }

  it('disables Continue when no roles are selected', () => {
    const { getByRole } = render(<StepRoleSelection {...defaultProps} />)
    const btn = getByRole('button', { name: /^next$/i })
    expect(btn).toBeDisabled()
  })

  it('enables Continue when at least one role is selected', () => {
    const { getByRole } = render(
      <StepRoleSelection
        {...defaultProps}
        selectedRoles={[ORGANIZER_ROLES[0]]}
      />,
    )
    const btn = getByRole('button', { name: /^next$/i })
    expect(btn).not.toBeDisabled()
  })

  it('calls onToggle when a role tile is clicked', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    const { getByText } = render(
      <StepRoleSelection {...defaultProps} onToggle={onToggle} />,
    )

    await user.click(getByText('Dive Center'))
    expect(onToggle).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'dive-center' }),
    )
  })

  it('calls onContinue when Continue is clicked', async () => {
    const onContinue = vi.fn()
    const user = userEvent.setup()
    const { getByRole } = render(
      <StepRoleSelection
        {...defaultProps}
        selectedRoles={[ORGANIZER_ROLES[0]]}
        onContinue={onContinue}
      />,
    )

    await user.click(getByRole('button', { name: /^next$/i }))
    expect(onContinue).toHaveBeenCalled()
  })

  it('marks selected roles with aria-pressed="true"', () => {
    const { getByText } = render(
      <StepRoleSelection
        {...defaultProps}
        selectedRoles={[ORGANIZER_ROLES[0]]}
      />,
    )
    const tile = getByText('Dive Center').closest('button')
    expect(tile).toHaveAttribute('aria-pressed', 'true')
  })

})
