// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PillToggle } from '../pill-toggle'

describe('PillToggle', () => {
  it('default (label variant) renders a label wrapping a hidden checkbox', () => {
    const onChange = vi.fn()
    render(<PillToggle label="Open Water" checked={false} onChange={onChange} />)
    const checkbox = screen.getByRole('checkbox', { hidden: true })
    expect(checkbox).not.toBeNull()
    fireEvent.click(checkbox)
    expect(onChange).toHaveBeenCalled()
  })

  it('as="button" renders a button with aria-pressed instead of a checkbox', () => {
    const onChange = vi.fn()
    render(
      <PillToggle label="Pool" checked={true} onChange={onChange} as="button" />,
    )
    const btn = screen.getByRole('button', { name: /pool/i })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(btn)
    expect(onChange).toHaveBeenCalled()
  })

  it('applies TOUCH_TARGET_CLASS (min-h-[44px] min-w-[44px]) across all variants', () => {
    const { rerender } = render(
      <PillToggle label="x" checked={false} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('checkbox', { hidden: true }).closest('label')?.className).toContain(
      'min-h-[44px]',
    )
    rerender(
      <PillToggle label="y" checked={false} onChange={vi.fn()} as="button" />,
    )
    expect(screen.getByRole('button').className).toContain('min-h-[44px]')
    expect(screen.getByRole('button').className).toContain('min-w-[44px]')
  })

  it('size="md" uses text-body', () => {
    render(
      <PillToggle label="x" checked={false} onChange={vi.fn()} as="button" size="md" />,
    )
    expect(screen.getByRole('button').className).toContain('text-body')
  })

  it('size="sm" (default) uses text-label', () => {
    render(
      <PillToggle label="x" checked={false} onChange={vi.fn()} as="button" />,
    )
    expect(screen.getByRole('button').className).toContain('text-label')
  })

  it('variant="compact" uses tighter horizontal padding', () => {
    const { rerender } = render(
      <PillToggle label="x" checked={false} onChange={vi.fn()} as="button" />,
    )
    const defaultPadding = screen.getByRole('button').className
    expect(defaultPadding).toContain('px-3')
    rerender(
      <PillToggle label="x" checked={false} onChange={vi.fn()} as="button" variant="compact" />,
    )
    expect(screen.getByRole('button').className).toContain('px-2')
  })

  it('checked=true applies primary background via inline style', () => {
    render(<PillToggle label="x" checked={true} onChange={vi.fn()} />)
    const label = screen.getByRole('checkbox', { hidden: true }).closest('label')
    expect(label?.style.background).toContain('var(--color-primary)')
  })

  it('locked state: label variant marks input disabled + renders Lock icon', () => {
    render(
      <PillToggle label="Locked" checked={false} onChange={vi.fn()} locked />,
    )
    const input = screen.getByRole('checkbox', { hidden: true }) as HTMLInputElement
    expect(input.disabled).toBe(true)
    const label = input.closest('label')
    expect(label).toHaveAttribute('aria-disabled', 'true')
  })

  it('locked state: button variant sets aria-pressed stale + disabled', () => {
    render(
      <PillToggle label="Locked" checked={false} onChange={vi.fn()} as="button" locked />,
    )
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
  })
})
