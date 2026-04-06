// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '../helpers/render'
import { FieldError, FieldLabel } from '@/components/ui/field-shell'

describe('FieldLabel', () => {
  it('associates label with control via htmlFor', () => {
    render(
      <FieldLabel htmlFor="field-id" required>
        Email
      </FieldLabel>,
    )
    const label = screen.getByText(/Email/)
    expect(label.tagName).toBe('LABEL')
    expect(label).toHaveAttribute('for', 'field-id')
  })

  it('shows required asterisk when required', () => {
    const { container } = render(
      <FieldLabel required>Name</FieldLabel>,
    )
    expect(container.textContent).toContain('*')
  })

  it('omits asterisk when not required', () => {
    const { container } = render(<FieldLabel>Optional</FieldLabel>)
    expect(container.textContent).not.toContain('*')
  })
})

describe('FieldError', () => {
  it('renders space-reserving element with opacity-0 when message is undefined', () => {
    const { container } = render(<FieldError id="e1" />)
    const el = container.querySelector('#e1')!
    expect(el).toBeTruthy()
    expect(el.className).toContain('opacity-0')
  })

  it('renders alert with id and message when provided', () => {
    render(<FieldError id="field-err" message="Required" />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Required')
    expect(alert).toHaveAttribute('id', 'field-err')
  })
})
