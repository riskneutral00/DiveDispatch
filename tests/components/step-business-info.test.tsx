// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '../helpers/render'
import { StepBusinessInfo, type BusinessInfoValues } from '@/components/onboarding/step-business-info'
import type { RoleConfig } from '@/lib/constants/roles'

// Stub the LanguagePicker — it depends on Convex useQuery
vi.mock('@/components/profiles/language-picker', () => ({
  LanguagePicker: ({ disabled }: { disabled?: boolean }) => (
    <div data-testid="language-picker" data-disabled={disabled} />
  ),
}))

// Minimal role configs for testing
const operatorRole: RoleConfig = {
  key: 'dive-center',
  clerkRole: 'DiveCenter',
  label: 'Dive Center',
  pluralLabel: 'Dive Centers',
  route: '/dive-center',
  browseRoute: '/resources/dive-centers',
  icon: () => null,
  isOrganizer: true,
  isResource: false,
  displayGroup: 'operator',
  tableName: 'diveCenters',
  description: 'Test',
}

const resourceRole: RoleConfig = {
  key: 'instructor',
  clerkRole: 'Instructor',
  label: 'Instructor',
  pluralLabel: 'Instructors',
  route: '/instructor',
  browseRoute: '/resources/instructors',
  icon: () => null,
  isOrganizer: false,
  isResource: true,
  displayGroup: 'resource',
  tableName: 'instructors',
  description: 'Test',
}

const emptyValues: BusinessInfoValues = {
  businessName: '',
  customerLanguages: [],
}

describe('StepBusinessInfo', () => {
  const defaultProps = {
    values: emptyValues,
    onChange: vi.fn(),
    onBack: vi.fn(),
    onContinue: vi.fn(),
  }

  describe('operator role', () => {
    it('disables Next when business name is empty', () => {
      const { getByRole } = render(
        <StepBusinessInfo {...defaultProps} selectedRoles={[operatorRole]} />,
      )
      expect(getByRole('button', { name: /^next$/i })).toBeDisabled()
    })

    it('enables Next when business name is filled', () => {
      const { getByRole } = render(
        <StepBusinessInfo
          {...defaultProps}
          selectedRoles={[operatorRole]}
          values={{ ...emptyValues, businessName: 'Scuba World' }}
        />,
      )
      expect(getByRole('button', { name: /^next$/i })).not.toBeDisabled()
    })

    it('calls onChange when business name is typed', () => {
      const onChange = vi.fn()
      const { getByLabelText } = render(
        <StepBusinessInfo
          {...defaultProps}
          selectedRoles={[operatorRole]}
          onChange={onChange}
        />,
      )
      fireEvent.change(getByLabelText(/^Business name/), {
        target: { value: 'Scuba World' },
      })
      expect(onChange).toHaveBeenCalledWith({
        ...emptyValues,
        businessName: 'Scuba World',
      })
    })

})

  describe('resource role', () => {
    it('renders placeholder message instead of form', () => {
      const { getByText, queryByLabelText, queryByTestId } = render(
        <StepBusinessInfo {...defaultProps} selectedRoles={[resourceRole]} />,
      )
      expect(getByText(/operators will find you/i)).toBeTruthy()
      expect(queryByLabelText('Business name')).toBeNull()
      expect(queryByTestId('language-picker')).toBeNull()
    })

    it('enables Next without requiring any input', () => {
      const { getByRole } = render(
        <StepBusinessInfo {...defaultProps} selectedRoles={[resourceRole]} />,
      )
      expect(getByRole('button', { name: /^next$/i })).not.toBeDisabled()
    })
  })

  it('calls onBack when Back is clicked', () => {
    const onBack = vi.fn()
    const { getByRole } = render(
      <StepBusinessInfo
        {...defaultProps}
        selectedRoles={[operatorRole]}
        onBack={onBack}
      />,
    )
    fireEvent.click(getByRole('button', { name: /^back$/i }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
