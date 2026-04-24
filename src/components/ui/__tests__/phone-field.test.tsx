// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      phoneInvalid: 'Invalid phone number',
    }
    return map[key] ?? key
  },
}))

import { PhoneField } from '../phone-field'

describe('PhoneField', () => {
  it('renders label + country select + number input', () => {
    render(
      <PhoneField
        label="Phone"
        value=""
        onChange={() => {}}
        defaultCountry="US"
      />,
    )
    expect(screen.getByText(/Phone/i)).toBeTruthy()
    expect(screen.getByRole('combobox', { name: /country/i })).toBeTruthy()
    expect(screen.getByRole('textbox')).toBeTruthy()
  })

  it('emits E.164 on typed number', () => {
    const onChange = vi.fn()
    render(
      <PhoneField
        label="Phone"
        value=""
        onChange={onChange}
        defaultCountry="US"
      />,
    )
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: '5551234567' } })
    const lastCall = onChange.mock.calls.at(-1)?.[0]
    expect(lastCall).toMatch(/^\+1/)
  })

  it('dedupes repeated calling code when country already selected', () => {
    const onChange = vi.fn()
    render(
      <PhoneField
        label="Phone"
        value=""
        onChange={onChange}
        defaultCountry="US"
      />,
    )
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: '+112312312332' } })
    const lastCall = onChange.mock.calls.at(-1)?.[0]
    expect(lastCall).toBe('+12312312332')
  })

  it('renders required asterisk when required', () => {
    const { container } = render(
      <PhoneField
        label="Phone"
        value=""
        onChange={() => {}}
        defaultCountry="US"
        required
      />,
    )
    expect(container.textContent).toMatch(/\*/)
  })

  it('shows error message when error prop set', () => {
    render(
      <PhoneField
        label="Phone"
        value=""
        onChange={() => {}}
        defaultCountry="US"
        error="Invalid"
      />,
    )
    expect(screen.getByRole('alert').textContent).toBe('Invalid')
  })

  it('caps number input maxLength based on calling code length', () => {
    render(
      <PhoneField
        label="Phone"
        value=""
        onChange={() => {}}
        defaultCountry="US"
      />,
    )
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.maxLength).toBe(14)
  })

  it('shows inline error on blur when value is non-empty and invalid', () => {
    render(
      <PhoneField
        label="Phone"
        value="+1555"
        onChange={() => {}}
        defaultCountry="US"
      />,
    )
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.blur(input)
    expect(screen.getByRole('alert').textContent).toBe('Invalid phone number')
  })

  it('no inline error on blur when value is empty', () => {
    render(
      <PhoneField
        label="Phone"
        value=""
        onChange={() => {}}
        defaultCountry="US"
      />,
    )
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.blur(input)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('no inline error on blur when value is a valid E.164', () => {
    render(
      <PhoneField
        label="Phone"
        value="+14155551234"
        onChange={() => {}}
        defaultCountry="US"
      />,
    )
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.blur(input)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
