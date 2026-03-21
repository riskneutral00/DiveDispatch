// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render } from '../helpers/render'
import { StepProfileSetup, type ProfileFormValues } from '@/components/onboarding/step-profile-setup'
import { ORGANIZER_ROLES, RESOURCE_ROLES } from '@/lib/constants/roles'

// Stub role icons
vi.mock('@/components/icons/role-icons', () => {
  const stub = () => <svg data-testid="icon" />
  return {
    DiveCenterIcon: stub, AgentIcon: stub, LiveaboardIcon: stub,
    DiveResortIcon: stub, DiveHostelIcon: stub, DiveSiteIcon: stub,
    InstructorIcon: stub, DiveMasterIcon: stub, BoatIcon: stub,
    EquipmentIcon: stub, PoolIcon: stub, CompressorIcon: stub,
  }
})

const emptyValues: ProfileFormValues = {
  firstName: '',
  lastName: '',
  businessName: '',
  city: '',
  country: '',
  contactEmail: '',
  contactPhone: '',
}

const diveCenterRole = ORGANIZER_ROLES.find((r) => r.key === 'dive-center')!
const instructorRole = RESOURCE_ROLES.find((r) => r.key === 'instructor')!

describe('StepProfileSetup', () => {
  const defaultProps = {
    selectedRoles: [diveCenterRole],
    initialValues: emptyValues,
    onBack: vi.fn(),
    onSubmit: vi.fn(),
    submitting: false,
    error: '',
  }

  it('renders all common form fields', () => {
    const { getByLabelText } = render(<StepProfileSetup {...defaultProps} />)
    expect(getByLabelText(/first name/i)).toBeInTheDocument()
    expect(getByLabelText(/last name/i)).toBeInTheDocument()
    expect(getByLabelText(/contact email/i)).toBeInTheDocument()
    expect(getByLabelText(/contact phone/i)).toBeInTheDocument()
    expect(getByLabelText(/city/i)).toBeInTheDocument()
    expect(getByLabelText(/country/i)).toBeInTheDocument()
  })

  it('shows business name field for organizer roles', () => {
    const { getByLabelText } = render(<StepProfileSetup {...defaultProps} />)
    expect(getByLabelText(/business name/i)).toBeInTheDocument()
  })

  it('hides business name for personal-only roles (instructor/dive-master)', () => {
    const { queryByLabelText } = render(
      <StepProfileSetup {...defaultProps} selectedRoles={[instructorRole]} />,
    )
    expect(queryByLabelText(/business name/i)).not.toBeInTheDocument()
  })

  it('disables submit when required fields are empty', () => {
    const { getByRole } = render(<StepProfileSetup {...defaultProps} />)
    expect(getByRole('button', { name: /complete setup/i })).toBeDisabled()
  })

  it('enables submit when all required fields are filled', async () => {
    const user = userEvent.setup()
    const { getByLabelText, getByRole } = render(
      <StepProfileSetup {...defaultProps} />,
    )

    await user.type(getByLabelText(/first name/i), 'John')
    await user.type(getByLabelText(/last name/i), 'Doe')
    await user.type(getByLabelText(/business name/i), 'Deep Blue Diving')
    await user.type(getByLabelText(/city/i), 'Koh Tao')
    await user.type(getByLabelText(/country/i), 'Thailand')
    await user.type(getByLabelText(/contact email/i), 'john@deepblue.com')
    await user.type(getByLabelText(/contact phone/i), '+66123456789')

    expect(getByRole('button', { name: /complete setup/i })).not.toBeDisabled()
  })

  it('calls onSubmit with form values on submit', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    const { getByLabelText, getByRole } = render(
      <StepProfileSetup {...defaultProps} onSubmit={onSubmit} />,
    )

    await user.type(getByLabelText(/first name/i), 'John')
    await user.type(getByLabelText(/last name/i), 'Doe')
    await user.type(getByLabelText(/business name/i), 'Deep Blue Diving')
    await user.type(getByLabelText(/city/i), 'Koh Tao')
    await user.type(getByLabelText(/country/i), 'Thailand')
    await user.type(getByLabelText(/contact email/i), 'john@deepblue.com')
    await user.type(getByLabelText(/contact phone/i), '+66123456789')

    await user.click(getByRole('button', { name: /complete setup/i }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'John',
        lastName: 'Doe',
        businessName: 'Deep Blue Diving',
        city: 'Koh Tao',
        country: 'Thailand',
        contactEmail: 'john@deepblue.com',
        contactPhone: '+66123456789',
      }),
    )
  })

  it('calls onBack when Back button is clicked', async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()
    const { getByRole } = render(
      <StepProfileSetup {...defaultProps} onBack={onBack} />,
    )

    await user.click(getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalled()
  })

  it('disables buttons when submitting', () => {
    const { getByRole } = render(
      <StepProfileSetup {...defaultProps} submitting />,
    )
    expect(getByRole('button', { name: /back/i })).toBeDisabled()
    expect(getByRole('button', { name: /complete setup/i })).toBeDisabled()
  })

  it('shows error message when provided', () => {
    const { getByText } = render(
      <StepProfileSetup {...defaultProps} error="Something went wrong" />,
    )
    expect(getByText('Something went wrong')).toBeInTheDocument()
  })

  it('shows selected role labels in subtitle', () => {
    const { getByText } = render(
      <StepProfileSetup
        {...defaultProps}
        selectedRoles={[diveCenterRole, instructorRole]}
      />,
    )
    expect(getByText('Dive Center · Instructor')).toBeInTheDocument()
  })
})
