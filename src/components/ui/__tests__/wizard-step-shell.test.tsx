// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WizardStepShell } from '../wizard-step-shell'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      back: 'Back',
      continue: 'Continue',
    }
    return map[key] ?? key
  },
}))

describe('WizardStepShell', () => {
  const basePrimary = { label: 'Next' }

  it('renders title and subtitle when provided', () => {
    render(
      <WizardStepShell title="Personal info" subtitle="Tell us about yourself" primary={basePrimary}>
        <p>body</p>
      </WizardStepShell>,
    )
    expect(screen.getByText('Personal info')).toBeInTheDocument()
    expect(screen.getByText('Tell us about yourself')).toBeInTheDocument()
  })

  it('card=true (default) wraps in glass-container Card', () => {
    const { container } = render(
      <WizardStepShell title="T" primary={basePrimary}>
        <p>body</p>
      </WizardStepShell>,
    )
    expect(container.querySelector('.glass-container')).not.toBeNull()
  })

  it('card=false renders bare without Card wrapper', () => {
    const { container } = render(
      <WizardStepShell card={false} primary={basePrimary}>
        <p>body</p>
      </WizardStepShell>,
    )
    expect(container.querySelector('.glass-container')).toBeNull()
  })

  it('autoAdvance=true calls primary.onClick once in effect and returns null', () => {
    const onClick = vi.fn()
    const { container } = render(
      <WizardStepShell autoAdvance primary={{ label: 'Next', onClick }} card={false}>
        <p>body</p>
      </WizardStepShell>,
    )
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(container.firstChild).toBeNull()
  })

  it('onSubmit renders a form with noValidate', () => {
    const onSubmit = vi.fn((e) => e.preventDefault())
    render(
      <WizardStepShell
        card={false}
        onSubmit={onSubmit}
        primary={{ label: 'Submit', type: 'submit' }}
      >
        <p>body</p>
      </WizardStepShell>,
    )
    const submit = screen.getByRole('button', { name: 'Submit' })
    const form = submit.closest('form')
    expect(form).not.toBeNull()
    expect(form).toHaveAttribute('novalidate')
    fireEvent.click(submit)
    expect(onSubmit).toHaveBeenCalled()
  })

  it('renders error inside aria-live polite region', () => {
    render(
      <WizardStepShell card={false} primary={basePrimary} error="Something broke">
        <p>body</p>
      </WizardStepShell>,
    )
    expect(screen.getByText('Something broke')).toBeInTheDocument()
    const live = screen.getByText('Something broke').closest('[aria-live]')
    expect(live).toHaveAttribute('aria-live', 'polite')
  })

  it('Back button renders with default t(back) label and disables while primary.loading', () => {
    const onBack = vi.fn()
    render(
      <WizardStepShell
        card={false}
        primary={{ label: 'Next', loading: true }}
        onBack={onBack}
      >
        <p>body</p>
      </WizardStepShell>,
    )
    const backBtn = screen.getByRole('button', { name: 'Back' })
    expect(backBtn).toBeDisabled()
  })

  it('primary.loading shows loading state on primary button', () => {
    render(
      <WizardStepShell card={false} primary={{ label: 'Save', loading: true }}>
        <p>body</p>
      </WizardStepShell>,
    )
    const saveBtn = screen.getByRole('button', { name: /save/i })
    expect(saveBtn).toBeDisabled()
  })

  it('clicking Back fires onBack', () => {
    const onBack = vi.fn()
    render(
      <WizardStepShell card={false} primary={basePrimary} onBack={onBack}>
        <p>body</p>
      </WizardStepShell>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })
})
