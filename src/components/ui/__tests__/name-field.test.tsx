// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NameField } from '../name-field'

describe('NameField', () => {
  it('renders with correct autoComplete for given scope', () => {
    render(<NameField scope="given" label="First name" value="" onChange={() => {}} />)
    const input = screen.getByLabelText(/First name/i) as HTMLInputElement
    expect(input.getAttribute('autoComplete')).toBe('given-name')
  })

  it('renders with correct autoComplete for family scope', () => {
    render(<NameField scope="family" label="Last name" value="" onChange={() => {}} />)
    expect(
      (screen.getByLabelText(/Last name/i) as HTMLInputElement).getAttribute('autoComplete'),
    ).toBe('family-name')
  })

  it('trims whitespace on blur', () => {
    const onChange = vi.fn()
    render(<NameField scope="given" label="First name" value="  Maria  " onChange={onChange} />)
    const input = screen.getByLabelText(/First name/i)
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith('Maria')
  })

  it('caps at 100 characters on change', () => {
    const onChange = vi.fn()
    render(<NameField scope="given" label="First name" value="" onChange={onChange} />)
    const input = screen.getByLabelText(/First name/i)
    fireEvent.change(input, { target: { value: 'x'.repeat(150) } })
    expect(onChange).toHaveBeenLastCalledWith('x'.repeat(100))
  })

  it('accepts unicode characters', () => {
    const onChange = vi.fn()
    render(<NameField scope="given" label="First name" value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: '星野' } })
    expect(onChange).toHaveBeenCalledWith('星野')
  })

  it('forwards required to the underlying input', () => {
    const { container } = render(
      <NameField scope="given" label="First name" value="" onChange={() => {}} required />,
    )
    expect(container.querySelector('input')?.hasAttribute('required')).toBe(true)
  })
})
