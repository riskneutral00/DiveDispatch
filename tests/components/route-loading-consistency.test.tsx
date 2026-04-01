// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '../helpers/render'
import DashboardLoading from '@/app/(dashboard)/loading'
import AuthLoading from '@/app/(auth)/loading'
import PortalLoading from '@/app/(portal)/loading'

describe('Route loading consistency', () => {
  it('dashboard loading uses shared labeled spinner', () => {
    render(<DashboardLoading />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('auth loading uses shared labeled spinner', () => {
    render(<AuthLoading />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('portal loading uses shared labeled spinner', () => {
    render(<PortalLoading />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
