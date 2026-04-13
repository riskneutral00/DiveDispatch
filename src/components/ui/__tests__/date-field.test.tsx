// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DateField } from '../date-field'
import { BirthdayField } from '../birthday-field'

describe('DateField', () => {
  it('renders segments with label and required asterisk', () => {
    const { container } = render(
      <DateField label="Date" value={null} onChange={() => {}} required />,
    )
    expect(screen.getByText(/Date/i)).toBeTruthy()
    expect(container.textContent).toMatch(/\*/)
  })

  it('parses and displays an ISO value', () => {
    render(<DateField label="Date" value="1990-06-15" onChange={() => {}} />)
    expect(screen.getByRole('group')).toBeTruthy()
  })

  it('ignores invalid ISO strings without throwing', () => {
    expect(() =>
      render(<DateField label="Date" value="not-a-date" onChange={() => {}} />),
    ).not.toThrow()
  })

  it('shows error message', () => {
    render(
      <DateField
        label="Date"
        value={null}
        onChange={() => {}}
        error="Required"
      />,
    )
    expect(screen.getByRole('alert').textContent).toBe('Required')
  })
})

describe('BirthdayField', () => {
  it('renders a DateField with label', () => {
    render(
      <BirthdayField label="Birthday" value={null} onChange={() => {}} />,
    )
    expect(screen.getByText(/Birthday/i)).toBeTruthy()
  })

  it('accepts a valid ISO birthdate', () => {
    const onChange = vi.fn()
    render(
      <BirthdayField
        label="Birthday"
        value="1988-03-22"
        onChange={onChange}
      />,
    )
    expect(screen.getByRole('group')).toBeTruthy()
  })
})
