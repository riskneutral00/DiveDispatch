// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmailField } from '../email-field'

describe('EmailField', () => {
  it('renders type=email with email autocomplete + inputmode', () => {
    render(<EmailField label="Email" value="" onChange={() => {}} />)
    const input = screen.getByLabelText(/Email/i) as HTMLInputElement
    expect(input.type).toBe('email')
    expect(input.getAttribute('autoComplete')).toBe('email')
    expect(input.getAttribute('inputMode')).toBe('email')
    expect(input.getAttribute('autoCapitalize')).toBe('none')
  })

  it('lowercases and trims on blur', () => {
    const onChange = vi.fn()
    render(<EmailField label="Email" value="  USER@EXAMPLE.COM  " onChange={onChange} />)
    fireEvent.blur(screen.getByLabelText(/Email/i))
    expect(onChange).toHaveBeenCalledWith('user@example.com')
  })

  it('preserves user input during typing (no forced lowercase mid-type)', () => {
    const onChange = vi.fn()
    render(<EmailField label="Email" value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'User@' } })
    expect(onChange).toHaveBeenCalledWith('User@')
  })
})
