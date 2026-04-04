// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '../helpers/render'
import { Input } from '../../src/components/ui/input'

describe('Input', () => {
  it('renders without error', () => {
    render(<Input />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('generates a unique id when none provided', () => {
    render(<Input label="Test" />)
    const input = screen.getByRole('textbox')
    expect(input.id).toBeTruthy()
  })

  it('uses external id when provided', () => {
    render(<Input id="custom-id" label="Test" />)
    expect(screen.getByRole('textbox').id).toBe('custom-id')
  })

  it('applies text-primary class to the input element', () => {
    render(<Input />)
    const input = screen.getByRole('textbox')
    expect(input.className).toContain('text-primary')
  })

  it('renders label when provided', () => {
    render(<Input label="Email" />)
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('shows error message', () => {
    render(<Input error="Required" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Required')
  })

  it('shows helper text when no error', () => {
    render(<Input id="test" helperText="Enter your email" />)
    expect(screen.getByText('Enter your email')).toBeInTheDocument()
  })

  it('applies disabled state', () => {
    render(<Input disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})
