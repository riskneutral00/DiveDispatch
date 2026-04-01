// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '../helpers/render'
import { Spinner } from '@/components/ui/spinner'

describe('Spinner', () => {
  it('renders a spinning element', () => {
    const { container } = render(<Spinner />)
    const spinner = container.querySelector('[aria-hidden]')
    expect(spinner).toBeInTheDocument()
    expect(spinner).toHaveClass('animate-spin')
  })

  it('defaults to md size (w-5 h-5)', () => {
    const { container } = render(<Spinner />)
    const spinner = container.querySelector('[aria-hidden]')
    expect(spinner).toHaveClass('w-5', 'h-5')
  })

  it('renders sm size (w-4 h-4)', () => {
    const { container } = render(<Spinner size="sm" />)
    const spinner = container.querySelector('[aria-hidden]')
    expect(spinner).toHaveClass('w-4', 'h-4')
  })

  it('renders lg size (w-8 h-8)', () => {
    const { container } = render(<Spinner size="lg" />)
    const spinner = container.querySelector('[aria-hidden]')
    expect(spinner).toHaveClass('w-8', 'h-8')
  })

  it('uses a screen-reader loading label when no visible label prop', () => {
    const { container } = render(<Spinner />)
    expect(container.querySelector('.sr-only')).toHaveTextContent('Loading')
  })

  it('renders label text when provided', () => {
    const { getByText } = render(<Spinner label="Loading…" />)
    expect(getByText('Loading…')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<Spinner className="text-blue-500" />)
    const spinner = container.querySelector('[aria-hidden]')
    expect(spinner).toHaveClass('text-blue-500')
  })
})
