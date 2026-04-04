// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Textarea } from '@/components/ui/textarea'

describe('Textarea', () => {
  it('includes text-primary class on the textarea element', () => {
    render(<Textarea data-testid="ta" />)
    const textarea = screen.getByTestId('ta')
    expect(textarea.className).toContain('text-primary')
  })

  it('merges custom className with text-primary', () => {
    render(<Textarea data-testid="ta" className="custom-class" />)
    const textarea = screen.getByTestId('ta')
    expect(textarea.className).toContain('text-primary')
    expect(textarea.className).toContain('custom-class')
  })

  it('renders label linked to textarea via htmlFor/id', () => {
    render(<Textarea label="Notes" />)
    const textarea = screen.getByLabelText('Notes')
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('renders error message with role=alert', () => {
    render(<Textarea label="Notes" error="Required" />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Required')
  })

  it('does not render duplicate className attributes', () => {
    const { container } = render(<Textarea data-testid="ta" />)
    const textarea = container.querySelector('textarea')!
    // If there were two className attributes, JSX would silently use the last one.
    // We verify text-primary is present alongside the glass classes.
    expect(textarea.className).toContain('text-primary')
    expect(textarea.className).toContain('glass')
    expect(textarea.className).toContain('glass-field')
  })
})
