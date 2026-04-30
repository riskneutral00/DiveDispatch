// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render } from '../helpers/render'
import { StepRoleSelection } from '@/components/onboarding/step-role-selection'
import {
  getSignupOperatorTiles,
  getSignupResourceTiles,
  type SignupRoleTileConfig,
} from '@/lib/constants/signup-role-tiles'

vi.mock('@/components/icons/role-icons', () => {
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

const operators = getSignupOperatorTiles()
const resources = getSignupResourceTiles()
const diveCenter = operators.find((t) => t.tileKey === 'dive-center') as SignupRoleTileConfig
const pool = resources.find((t) => t.tileKey === 'pool') as SignupRoleTileConfig
const diveSite = resources.find((t) => t.tileKey === 'dive-site') as SignupRoleTileConfig

describe('StepRoleSelection', () => {
  const defaultProps = {
    selectedTiles: [] as SignupRoleTileConfig[],
    onToggle: vi.fn(),
    onContinue: vi.fn(),
  }

  it('disables Continue when no tiles are selected', () => {
    const { getByRole } = render(<StepRoleSelection {...defaultProps} />)
    const btn = getByRole('button', { name: /^next$/i })
    expect(btn).toBeDisabled()
  })

  it('enables Continue when at least one tile is selected', () => {
    const { getByRole } = render(
      <StepRoleSelection {...defaultProps} selectedTiles={[diveCenter]} />,
    )
    const btn = getByRole('button', { name: /^next$/i })
    expect(btn).not.toBeDisabled()
  })

  it('calls onToggle when a tile is clicked', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    const { getByText } = render(
      <StepRoleSelection {...defaultProps} onToggle={onToggle} />,
    )

    await user.click(getByText('Dive Center'))
    expect(onToggle).toHaveBeenCalledWith(
      expect.objectContaining({ tileKey: 'dive-center' }),
    )
  })

  it('renders Pool and Dive Site as separate Resources tiles', () => {
    const { getByText, queryByText } = render(<StepRoleSelection {...defaultProps} />)
    expect(getByText('Pool')).toBeInTheDocument()
    expect(getByText('Dive Site')).toBeInTheDocument()
    expect(queryByText(/^Venue$/)).toBeNull()
  })

  it('Pool and Dive Site tiles both toggle independently', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    const { getByText } = render(
      <StepRoleSelection {...defaultProps} onToggle={onToggle} />,
    )
    await user.click(getByText('Pool'))
    expect(onToggle).toHaveBeenCalledWith(
      expect.objectContaining({ tileKey: 'pool', venueKindHint: 'pool' }),
    )
    onToggle.mockClear()
    const diveSiteButton = getByText('Dive Site').closest('button') as HTMLButtonElement
    expect(diveSiteButton).not.toHaveAttribute('aria-disabled', 'true')
    await user.click(getByText('Dive Site'))
    expect(onToggle).toHaveBeenCalledWith(
      expect.objectContaining({ tileKey: 'dive-site', venueKindHint: 'dive_site' }),
    )
  })

  it('summary collapses both Venue tiles into one umbrella entry', () => {
    const { getAllByText } = render(
      <StepRoleSelection {...defaultProps} selectedTiles={[pool, diveSite]} />,
    )
    const matches = getAllByText(/Venue:/)
    expect(matches).toHaveLength(1)
  })

  it('summary shows single tile description when only one Venue kind selected', () => {
    const { getByText, queryByText } = render(
      <StepRoleSelection {...defaultProps} selectedTiles={[pool]} />,
    )
    expect(getByText(/Pool:/)).toBeInTheDocument()
    expect(queryByText(/Venue:/)).toBeNull()
  })

  it('calls onContinue when Continue is clicked', async () => {
    const onContinue = vi.fn()
    const user = userEvent.setup()
    const { getByRole } = render(
      <StepRoleSelection
        {...defaultProps}
        selectedTiles={[diveCenter]}
        onContinue={onContinue}
      />,
    )

    await user.click(getByRole('button', { name: /^next$/i }))
    expect(onContinue).toHaveBeenCalled()
  })

  it('marks selected tiles with aria-pressed="true"', () => {
    const { getByText } = render(
      <StepRoleSelection {...defaultProps} selectedTiles={[diveCenter]} />,
    )
    const tile = getByText('Dive Center').closest('button')
    expect(tile).toHaveAttribute('aria-pressed', 'true')
  })

  it('Dive Site tile is fully selectable (no tooltip, no aria-disabled)', () => {
    const { getByText, queryByRole } = render(
      <StepRoleSelection {...defaultProps} />,
    )
    const button = getByText('Dive Site').closest('button') as HTMLButtonElement
    expect(button).not.toHaveAttribute('aria-disabled', 'true')
    expect(queryByRole('tooltip')).toBeNull()
  })
})
