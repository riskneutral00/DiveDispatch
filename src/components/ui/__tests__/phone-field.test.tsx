// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
})
