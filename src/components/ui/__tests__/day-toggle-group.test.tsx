// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DayToggleGroup } from '../day-toggle-group'

describe('DayToggleGroup', () => {
  it('renders 7 day buttons', () => {
    render(<DayToggleGroup selected={[]} onChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(7)
  })

  it('clicking an unselected day adds it via onChange', () => {
    const onChange = vi.fn()
    render(<DayToggleGroup selected={[]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Wed' }))
    expect(onChange).toHaveBeenCalledWith([3])
  })

  it('clicking a selected day removes it via onChange', () => {
    const onChange = vi.fn()
    render(<DayToggleGroup selected={[1, 3, 5]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Wed' }))
    expect(onChange).toHaveBeenCalledWith([1, 5])
  })

  it('disabled days render disabled attribute and do not fire onChange', () => {
    const onChange = vi.fn()
    render(<DayToggleGroup selected={[]} onChange={onChange} disabledDays={[0, 6]} />)
    const sat = screen.getByRole('button', { name: 'Sat' })
    expect(sat).toBeDisabled()
    fireEvent.click(sat)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('active button has aria-pressed=true and primary background', () => {
    render(<DayToggleGroup selected={[1]} onChange={vi.fn()} />)
    const mon = screen.getByRole('button', { name: 'Mon' })
    expect(mon).toHaveAttribute('aria-pressed', 'true')
    expect(mon.style.background).toContain('var(--color-primary)')
  })

  it('inactive button has aria-pressed=false and no inline background', () => {
    render(<DayToggleGroup selected={[]} onChange={vi.fn()} />)
    const mon = screen.getByRole('button', { name: 'Mon' })
    expect(mon).toHaveAttribute('aria-pressed', 'false')
    expect(mon.style.background).toBe('')
  })

  it('applies TOUCH_TARGET_CLASS (min-h-[44px] min-w-[44px])', () => {
    render(<DayToggleGroup selected={[]} onChange={vi.fn()} />)
    const mon = screen.getByRole('button', { name: 'Mon' })
    expect(mon.className).toContain('min-h-[44px]')
    expect(mon.className).toContain('min-w-[44px]')
  })

  it('does not use off-ladder px-2.5', () => {
    render(<DayToggleGroup selected={[]} onChange={vi.fn()} />)
    const mon = screen.getByRole('button', { name: 'Mon' })
    expect(mon.className).not.toContain('px-2.5')
  })

  it('renders no group label when label prop is omitted, while seven day buttons remain accessible by name', () => {
    const { container } = render(<DayToggleGroup selected={[]} onChange={vi.fn()} />)
    expect(container.querySelector('label')).toBeNull()
    expect(container.querySelector('fieldset')).toBeNull()
    expect(screen.queryByRole('group')).toBeNull()

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    dayNames.forEach((name) => {
      const btn = screen.getByRole('button', { name })
      expect(btn).not.toBeNull()
      expect(btn.tagName).toBe('BUTTON')
    })
  })

  it('renders InlineError as a DOM descendant of the reading-plane wrapper when error is provided', () => {
    const { container } = render(
      <DayToggleGroup selected={[]} onChange={vi.fn()} error="Pick at least one day" />,
    )
    const wrapper = container.querySelector('.reading-plane') as HTMLElement | null
    expect(wrapper).not.toBeNull()
    const errorEl = container.querySelector('[role="alert"]')
    expect(errorEl).not.toBeNull()
    expect(errorEl!.textContent).toContain('Pick at least one day')
    expect(wrapper!.contains(errorEl)).toBe(true)
  })

  it('clicking a disabled day does NOT call onChange and does NOT flip aria-pressed', () => {
    const onChange = vi.fn()
    render(
      <DayToggleGroup selected={[]} onChange={onChange} disabledDays={[2]} />,
    )
    const tue = screen.getByRole('button', { name: 'Tue' })
    expect(tue).toBeDisabled()
    expect(tue).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(tue)
    expect(onChange).not.toHaveBeenCalled()
    expect(tue).toHaveAttribute('aria-pressed', 'false')
  })
})
