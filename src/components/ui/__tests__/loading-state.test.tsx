// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingState } from '../loading-state'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => (key === 'loading' ? 'Loading…' : key),
}))

describe('LoadingState', () => {
  it('renders spinner with sr-only default message from t(common.loading)', () => {
    render(<LoadingState />)
    const status = screen.getByRole('status')
    expect(status).toBeInTheDocument()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('variant="pulse" renders animated pulse text', () => {
    const { container } = render(<LoadingState variant="pulse" />)
    const pulse = container.querySelector('.animate-pulse')
    expect(pulse).not.toBeNull()
    expect(pulse?.textContent).toBe('Loading…')
  })

  it('variant="bar" renders indeterminate progress bar', () => {
    render(<LoadingState variant="bar" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toBeInTheDocument()
    expect(bar.getAttribute('aria-valuenow')).toBeNull()
  })

  it('scope="card" wraps output in glass-container card with py-8 padding', () => {
    const { container } = render(<LoadingState scope="card" />)
    const card = container.querySelector('.glass-container')
    expect(card).not.toBeNull()
    expect(card?.className).toContain('py-8')
  })

  it('scope="page" uses min-h-screen centered layout', () => {
    const { container } = render(<LoadingState scope="page" />)
    const page = container.firstElementChild
    expect(page?.className).toContain('min-h-screen')
    expect(page?.className).toContain('items-center')
    expect(page?.className).toContain('justify-center')
  })

  it('scope="inline" (default) does not render a card wrapper', () => {
    const { container } = render(<LoadingState />)
    expect(container.querySelector('.glass-container')).toBeNull()
    expect(container.querySelector('.min-h-screen')).toBeNull()
  })

  it('message prop overrides default translation', () => {
    render(<LoadingState variant="pulse" message="Syncing roster…" />)
    expect(screen.getByText('Syncing roster…')).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).toBeNull()
  })

  it('renders literal message when translation returns empty', () => {
    render(<LoadingState variant="pulse" message="Fallback label" />)
    expect(screen.getByText('Fallback label')).toBeInTheDocument()
  })

  it('accepts className for external positioning', () => {
    const { container } = render(<LoadingState className="mt-4 self-center" />)
    expect(container.firstElementChild?.className).toContain('mt-4')
    expect(container.firstElementChild?.className).toContain('self-center')
  })
})
