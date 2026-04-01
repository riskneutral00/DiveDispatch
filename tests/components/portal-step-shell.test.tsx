// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '../helpers/render'
import { PortalStepShell } from '@/components/portal/portal-step-shell'

describe('PortalStepShell', () => {
  it('renders children', () => {
    render(
      <PortalStepShell onContinue={vi.fn()}>
        <div>Step content</div>
      </PortalStepShell>,
    )
    expect(screen.getByText('Step content')).toBeInTheDocument()
  })

  it('shows server error in alert region', () => {
    render(
      <PortalStepShell serverError="Something failed" onContinue={vi.fn()}>
        <p>Body</p>
      </PortalStepShell>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Something failed')
  })

  it('calls onContinue when primary button clicked', () => {
    const onContinue = vi.fn()
    render(
      <PortalStepShell onContinue={onContinue}>
        <p>Body</p>
      </PortalStepShell>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('renders Back and Continue when onBack provided', () => {
    const onBack = vi.fn()
    const onContinue = vi.fn()
    render(
      <PortalStepShell onBack={onBack} onContinue={onContinue}>
        <p>Body</p>
      </PortalStepShell>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('uses custom continue label', () => {
    render(
      <PortalStepShell onContinue={vi.fn()} continueLabel="Next">
        <p>Body</p>
      </PortalStepShell>,
    )
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
  })
})
