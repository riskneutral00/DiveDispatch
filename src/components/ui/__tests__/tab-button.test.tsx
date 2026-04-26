// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { TabButton } from '../tab-button'

describe('TabButton', () => {
  function renderButton(overrides: Partial<Parameters<typeof TabButton>[0]> = {}) {
    return render(
      <TabButton
        id="general"
        label="General"
        active={false}
        onSelect={vi.fn()}
        controlsId="tabpanel-general"
        {...overrides}
      />,
    )
  }

  it('renders button with role="tab" and correct ARIA attributes when active', () => {
    renderButton({ active: true })
    const btn = screen.getByRole('tab')
    expect(btn).toHaveAttribute('aria-selected', 'true')
    expect(btn).toHaveAttribute('aria-controls', 'tabpanel-general')
    expect(btn).toHaveAttribute('tabindex', '0')
  })

  it('renders correct ARIA attributes when inactive', () => {
    renderButton({ active: false })
    const btn = screen.getByRole('tab')
    expect(btn).toHaveAttribute('aria-selected', 'false')
    expect(btn).toHaveAttribute('tabindex', '-1')
  })

  it('variant="underline" (default) renders 2px bottom-border — primary when active, transparent when not', () => {
    const { rerender } = renderButton({ active: true })
    let btn = screen.getByRole('tab')
    expect(btn.style.borderBottom).toContain('var(--color-primary)')
    rerender(
      <TabButton
        id="general"
        label="General"
        active={false}
        onSelect={vi.fn()}
        controlsId="tabpanel-general"
      />,
    )
    btn = screen.getByRole('tab')
    expect(btn.style.borderBottom).toContain('transparent')
  })

  it('variant="pill" renders rounded pill shape without bottom-border', () => {
    renderButton({ variant: 'pill', active: true })
    const btn = screen.getByRole('tab')
    expect(btn.className).toContain('rounded-full')
    expect(btn.style.borderBottom).toBe('')
  })

  it('renders label prop as button text', () => {
    renderButton({ label: 'Safety' })
    expect(screen.getByText('Safety')).toBeInTheDocument()
  })

  it('fires onSelect(id) on click', () => {
    const onSelect = vi.fn()
    renderButton({ id: 'medical', onSelect })
    fireEvent.click(screen.getByRole('tab'))
    expect(onSelect).toHaveBeenCalledWith('medical')
  })

  it('active button has text-primary + font-semibold; inactive has text-secondary + font-normal', () => {
    const { rerender } = renderButton({ active: true })
    let btn = screen.getByRole('tab')
    expect(btn.className).toContain('text-primary')
    expect(btn.className).toContain('font-semibold')
    rerender(
      <TabButton
        id="general"
        label="General"
        active={false}
        onSelect={vi.fn()}
        controlsId="tabpanel-general"
      />,
    )
    btn = screen.getByRole('tab')
    expect(btn.className).toContain('text-secondary')
    expect(btn.className).toContain('font-normal')
  })

  it('meets 44px touch target via TOUCH_TARGET_CLASS', () => {
    renderButton({ active: true })
    const btn = screen.getByRole('tab')
    expect(btn.className).toContain('min-h-[44px]')
  })

  it('sets aria-required when required prop is true', () => {
    renderButton({ required: true })
    expect(screen.getByRole('tab')).toHaveAttribute('aria-required', 'true')
  })

  it('omits aria-required when required is unset or false', () => {
    const { rerender } = renderButton()
    expect(screen.getByRole('tab')).not.toHaveAttribute('aria-required')
    rerender(
      <TabButton
        id="general"
        label="General"
        active={false}
        onSelect={vi.fn()}
        controlsId="tabpanel-general"
        required={false}
      />,
    )
    expect(screen.getByRole('tab')).not.toHaveAttribute('aria-required')
  })

  it('ariaRequired overrides required for ARIA-only signaling', () => {
    renderButton({ required: false, ariaRequired: true })
    expect(screen.getByRole('tab')).toHaveAttribute('aria-required', 'true')
  })

  it('renders ReactNode label (e.g. label with appended asterisk)', () => {
    renderButton({
      label: (
        <>
          Instructors<span data-testid="ast">{' *'}</span>
        </>
      ),
    })
    const btn = screen.getByRole('tab')
    expect(btn.textContent).toContain('Instructors')
    expect(screen.getByTestId('ast')).toBeInTheDocument()
  })

  it('tabRef forwards to underlying button element', () => {
    const ref = createRef<HTMLButtonElement>()
    render(
      <TabButton
        id="general"
        label="General"
        active
        onSelect={vi.fn()}
        controlsId="tabpanel-general"
        tabRef={ref}
      />,
    )
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })
})
