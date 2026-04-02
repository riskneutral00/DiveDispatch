// @vitest-environment jsdom
/**
 * DD-363: PostTripPage component render tests
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '../helpers/render'
import { PostTripPage } from '@/components/portal/post-trip-page'

const baseProps = {
  operatorName: 'Blue Ocean Dive Center',
  startDate: '2026-03-20',
  endDate: '2026-03-25',
}

describe('PostTripPage', () => {
  it('renders the review heading', () => {
    render(<PostTripPage {...baseProps} />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('renders a Google Maps review link that opens in a new tab', () => {
    render(<PostTripPage {...baseProps} />)
    const googleLink = screen.getByRole('link', { name: /google/i })
    expect(googleLink).toBeInTheDocument()
    expect(googleLink).toHaveAttribute('target', '_blank')
    expect(googleLink).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('renders a Facebook review link that opens in a new tab', () => {
    render(<PostTripPage {...baseProps} />)
    const facebookLink = screen.getByRole('link', { name: /facebook/i })
    expect(facebookLink).toBeInTheDocument()
    expect(facebookLink).toHaveAttribute('target', '_blank')
    expect(facebookLink).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('renders a sign-up link pointing to /sign-up', () => {
    render(<PostTripPage {...baseProps} />)
    const signupLink = screen.getByRole('link', { name: /sign up/i })
    expect(signupLink).toBeInTheDocument()
    expect(signupLink).toHaveAttribute('href', '/sign-up')
  })

  it('renders the operator name', () => {
    render(<PostTripPage {...baseProps} />)
    expect(screen.getByText('Blue Ocean Dive Center')).toBeInTheDocument()
  })

  it('renders identically for DiveCenter operator data', () => {
    const { container } = render(
      <PostTripPage
        operatorName="Sea Explorer Dive Center"
        startDate="2026-03-10"
        endDate="2026-03-12"
      />,
    )
    expect(container.querySelector('[data-testid="post-trip-page"]')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /google/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /facebook/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument()
  })

  it('renders identically for Agent operator data', () => {
    const { container } = render(
      <PostTripPage
        operatorName="Pacific Dive Agency"
        startDate="2026-02-01"
        endDate="2026-02-07"
      />,
    )
    expect(container.querySelector('[data-testid="post-trip-page"]')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /google/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /facebook/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument()
  })

  it('renders identically for Liveaboard operator data', () => {
    const { container } = render(
      <PostTripPage
        operatorName="Ocean Dreams Liveaboard"
        startDate="2026-01-15"
        endDate="2026-01-22"
      />,
    )
    expect(container.querySelector('[data-testid="post-trip-page"]')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /google/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /facebook/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument()
  })
})
