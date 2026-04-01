// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '../helpers/render'
import { DashboardPageFrame } from '@/components/layout/dashboard-page-frame'

describe('DashboardPageFrame', () => {
  it('applies max-width class from maxWidth prop', () => {
    const { container } = render(
      <DashboardPageFrame maxWidth="lg" padding="none">
        <p>Child</p>
      </DashboardPageFrame>,
    )
    const outer = container.firstChild as HTMLElement
    expect(outer.className).toContain('max-w-lg')
    expect(outer.className).toContain('mx-auto')
  })

  it('adds mobile nav clearance padding when requested', () => {
    const { container } = render(
      <DashboardPageFrame maxWidth="3xl" padding="mobileNavClearance">
        <p>X</p>
      </DashboardPageFrame>,
    )
    const outer = container.firstChild as HTMLElement
    expect(outer.className).toContain('pb-28')
  })

  it('renders PageTitle when title or description provided', () => {
    render(
      <DashboardPageFrame title="Profile" description="Dive Center">
        <p>Form</p>
      </DashboardPageFrame>,
    )
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByText('Dive Center')).toBeInTheDocument()
    expect(screen.getByText('Form')).toBeInTheDocument()
  })
})
