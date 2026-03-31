// @vitest-environment jsdom
/**
 * Tests for LanguagePicker:
 * 1. Search input has max-width constraint (not full container width)
 * 2. Flag grid renders popular languages
 * 3. Toggle selection works
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '../helpers/render'
import { screen, fireEvent } from '@testing-library/react'
import { LanguagePicker } from '../../src/components/profiles/language-picker'

describe('LanguagePicker', () => {
  it('search input container has max-width constraint', () => {
    const { container } = render(
      <LanguagePicker value={[]} onChange={() => {}} />,
    )
    const inputWrapper = container.querySelector('input[type="text"]')?.parentElement
    expect(inputWrapper).toBeTruthy()
    expect(inputWrapper!.className).toMatch(/max-w-xs/)
  })

  it('renders popular language flag buttons', () => {
    render(<LanguagePicker value={[]} onChange={() => {}} />)
    // Should have at least some flag buttons with aria-pressed
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(5)
    // All should have aria-pressed attribute
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute('aria-pressed')
    })
  })

  it('toggles language selection on click', () => {
    const onChange = vi.fn()
    render(<LanguagePicker value={[]} onChange={onChange} />)
    const firstButton = screen.getAllByRole('button')[0]
    fireEvent.click(firstButton)
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ code: expect.any(String) }),
      ]),
    )
  })
})
