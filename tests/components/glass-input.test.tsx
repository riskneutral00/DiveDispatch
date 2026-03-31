// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '../helpers/render'
import { GlassInput } from '../../src/components/ui/glass-input'

describe('GlassInput', () => {
  it('renders without error', () => {
    render(<GlassInput />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('generates a unique id when none provided', () => {
    render(<GlassInput label="Test" />)
    const input = screen.getByRole('textbox')
    expect(input.id).toBeTruthy()
  })

  it('uses external id when provided', () => {
    render(<GlassInput id="custom-id" label="Test" />)
    expect(screen.getByRole('textbox').id).toBe('custom-id')
  })

  it('applies text-primary class to the input element', () => {
    render(<GlassInput />)
    const input = screen.getByRole('textbox')
    expect(input.className).toContain('text-primary')
  })

  it('renders label when provided', () => {
    render(<GlassInput label="Email" />)
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('shows error message', () => {
    render(<GlassInput error="Required" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Required')
  })

  it('shows helper text when no error', () => {
    render(<GlassInput id="test" helperText="Enter your email" />)
    expect(screen.getByText('Enter your email')).toBeInTheDocument()
  })

  it('applies disabled state', () => {
    render(<GlassInput disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})
