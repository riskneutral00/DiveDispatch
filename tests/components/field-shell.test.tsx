// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '../helpers/render'
import { GlassFieldError, GlassFieldLabel } from '@/components/ui/field-shell'

describe('GlassFieldLabel', () => {
  it('associates label with control via htmlFor', () => {
    render(
      <GlassFieldLabel htmlFor="field-id" required>
        Email
      </GlassFieldLabel>,
    )
    const label = screen.getByText(/Email/)
    expect(label.tagName).toBe('LABEL')
    expect(label).toHaveAttribute('for', 'field-id')
  })

  it('shows required asterisk when required', () => {
    const { container } = render(
      <GlassFieldLabel required>Name</GlassFieldLabel>,
    )
    expect(container.textContent).toContain('*')
  })

  it('omits asterisk when not required', () => {
    const { container } = render(<GlassFieldLabel>Optional</GlassFieldLabel>)
    expect(container.textContent).not.toContain('*')
  })
})

describe('GlassFieldError', () => {
  it('renders nothing when message is undefined', () => {
    const { container } = render(<GlassFieldError id="e1" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders alert with id and message when provided', () => {
    render(<GlassFieldError id="field-err" message="Required" />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Required')
    expect(alert).toHaveAttribute('id', 'field-err')
  })
})
