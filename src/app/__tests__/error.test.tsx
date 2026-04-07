// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import enMessages from '../../../messages/en.json'
import RootError from '../error'

vi.mock('lucide-react', () => ({
  AlertTriangle: (props: Record<string, unknown>) => (
    <svg data-testid="alert-icon" {...props} />
  ),
}))

vi.mock('@/components/ui/error-card', () => ({
  ErrorCard: ({
    title,
    message,
    action,
  }: {
    icon: unknown
    title: string
    message: string
    action?: React.ReactNode
  }) => (
    <div data-testid="glass-error-card">
      <h2>{title}</h2>
      <p>{message}</p>
      {action && <div data-testid="action">{action}</div>}
    </div>
  ),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => (
    <button data-testid="glass-button" onClick={onClick}>
      {children}
    </button>
  ),
}))

describe('RootError boundary', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('renders fallback UI with title and message', () => {
    const error = new Error('Test failure')
    const reset = vi.fn()

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <RootError error={error} reset={reset} />
      </NextIntlClientProvider>,
    )

    expect(screen.getByText('An error occurred')).toBeInTheDocument()
    expect(
      screen.getByText('An error occurred. Try again.')
    ).toBeInTheDocument()
  })

  it('logs the error to console.error on mount', () => {
    const error = new Error('Boom')
    const reset = vi.fn()

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <RootError error={error} reset={reset} />
      </NextIntlClientProvider>,
    )

    expect(consoleSpy).toHaveBeenCalledWith('[Root Error]', error)
  })

  it('renders a "Try again" button that calls reset', () => {
    const error = new Error('Kaboom')
    const reset = vi.fn()

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <RootError error={error} reset={reset} />
      </NextIntlClientProvider>,
    )

    const button = screen.getByTestId('glass-button')
    expect(button.textContent).toBe('Retry')

    fireEvent.click(button)
    expect(reset).toHaveBeenCalledOnce()
  })

})
