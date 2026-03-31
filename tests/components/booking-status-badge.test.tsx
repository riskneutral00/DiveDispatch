// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '../helpers/render'
import { BookingStatusBadge } from '../../src/components/ui/booking-status-badge'

describe('BookingStatusBadge', () => {
  it('renders status text', () => {
    render(<BookingStatusBadge status="Draft" />)
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('applies text-secondary in fallback branch for unknown status', () => {
    render(<BookingStatusBadge status="UnknownStatus" />)
    const badge = screen.getByText('UnknownStatus')
    expect(badge.className).toContain('text-secondary')
  })

  it('renders with sm size by default', () => {
    render(<BookingStatusBadge status="Draft" />)
    const badge = screen.getByText('Draft')
    expect(badge.className).toContain('text-xs')
  })

  it('renders with md size when specified', () => {
    render(<BookingStatusBadge status="Draft" size="md" />)
    const badge = screen.getByText('Draft')
    expect(badge.className).toContain('text-sm')
  })

  it('appends custom className', () => {
    render(<BookingStatusBadge status="UnknownStatus" className="my-custom" />)
    const badge = screen.getByText('UnknownStatus')
    expect(badge.className).toContain('my-custom')
  })
})
