// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '../helpers/render'
import { StepAboutYou, type AboutYouValues } from '@/components/onboarding/step-about-you'
import type { Language } from '@/lib/types/language'

// Stub the LanguagePicker — it depends on Convex useQuery
vi.mock('@/components/common/language-picker', () => ({
  LanguagePicker: ({ disabled }: { disabled?: boolean }) => (
    <div data-testid="language-picker" data-disabled={disabled} />
  ),
}))

const english: Language = { code: 'GB', label: 'English' }

const emptyValues: AboutYouValues = {
  operatingLanguage: null,
  firstName: '',
  lastName: '',
  nickname: '',
  phone: '',
  preferredChannel: null,
}

describe('StepAboutYou', () => {
  const defaultProps = {
    values: emptyValues,
    onChange: vi.fn(),
    onContinue: vi.fn(),
  }

  it('renders all required fields', () => {
    const { getByLabelText, getByText, getByTestId } = render(
      <StepAboutYou {...defaultProps} />,
    )
    expect(getByText('App language')).toBeTruthy()
    expect(getByLabelText('First name')).toBeTruthy()
    expect(getByLabelText('Last name')).toBeTruthy()
    expect(getByLabelText(/nickname/i)).toBeTruthy()
    expect(getByLabelText('Phone')).toBeTruthy()
    expect(getByText('Preferred communication channel')).toBeTruthy()
    expect(getByTestId('language-picker')).toBeTruthy()
  })

  it('renders all communication channel options', () => {
    const { getByText } = render(<StepAboutYou {...defaultProps} />)
    expect(getByText('WhatsApp')).toBeTruthy()
    expect(getByText('LINE')).toBeTruthy()
    expect(getByText('Messenger')).toBeTruthy()
    expect(getByText('WeChat')).toBeTruthy()
    expect(getByText('KakaoTalk')).toBeTruthy()
    expect(getByText('Instagram')).toBeTruthy()
  })

  it('disables Next when no app language is selected', () => {
    const { getByRole } = render(<StepAboutYou {...defaultProps} />)
    expect(getByRole('button', { name: /^next$/i })).toBeDisabled()
  })

  it('disables Next when app language is set but first name is empty', () => {
    const { getByRole } = render(
      <StepAboutYou
        {...defaultProps}
        values={{ ...emptyValues, operatingLanguage: english, lastName: 'Smith' }}
      />,
    )
    expect(getByRole('button', { name: /^next$/i })).toBeDisabled()
  })

  it('disables Next when app language is set but last name is empty', () => {
    const { getByRole } = render(
      <StepAboutYou
        {...defaultProps}
        values={{ ...emptyValues, operatingLanguage: english, firstName: 'Mike' }}
      />,
    )
    expect(getByRole('button', { name: /^next$/i })).toBeDisabled()
  })

  it('enables Next when app language, first name, and last name are set', () => {
    const { getByRole } = render(
      <StepAboutYou
        {...defaultProps}
        values={{
          ...emptyValues,
          operatingLanguage: english,
          firstName: 'Mike',
          lastName: 'Smith',
        }}
      />,
    )
    expect(getByRole('button', { name: /^next$/i })).not.toBeDisabled()
  })

  it('calls onContinue when Next is clicked', () => {
    const onContinue = vi.fn()
    const { getByRole } = render(
      <StepAboutYou
        {...defaultProps}
        values={{
          ...emptyValues,
          operatingLanguage: english,
          firstName: 'Mike',
          lastName: 'Smith',
        }}
        onContinue={onContinue}
      />,
    )
    fireEvent.click(getByRole('button', { name: /^next$/i }))
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('calls onChange when first name is typed', () => {
    const onChange = vi.fn()
    const { getByLabelText } = render(
      <StepAboutYou {...defaultProps} onChange={onChange} />,
    )
    fireEvent.change(getByLabelText('First name'), { target: { value: 'Mike' } })
    expect(onChange).toHaveBeenCalledWith({
      ...emptyValues,
      firstName: 'Mike',
    })
  })

  it('toggles communication channel selection', () => {
    const onChange = vi.fn()
    const { getByText } = render(
      <StepAboutYou {...defaultProps} onChange={onChange} />,
    )
    fireEvent.click(getByText('LINE'))
    expect(onChange).toHaveBeenCalledWith({
      ...emptyValues,
      preferredChannel: 'LINE',
    })
  })

  it('deselects communication channel when clicked again', () => {
    const onChange = vi.fn()
    const { getByText } = render(
      <StepAboutYou
        {...defaultProps}
        values={{ ...emptyValues, preferredChannel: 'LINE' }}
        onChange={onChange}
      />,
    )
    fireEvent.click(getByText('LINE'))
    expect(onChange).toHaveBeenCalledWith({
      ...emptyValues,
      preferredChannel: null,
    })
  })
})
