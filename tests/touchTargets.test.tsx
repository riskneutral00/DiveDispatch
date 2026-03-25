// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { GlassButton } from '@/components/glass/glass-button'

const WCAG_MIN_PX = 44

const sizes = ['sm', 'md', 'lg', 'icon'] as const

describe('Touch targets — WCAG 2.5.8 (44x44px minimum)', () => {
  it.each(sizes)('GlassButton size="%s" has min-h-[44px] class', (size) => {
    const { container } = render(
      <GlassButton size={size}>Test</GlassButton>,
    )
    const btn = container.firstElementChild as HTMLElement
    const classes = btn.className
    expect(classes).toContain('min-h-[44px]')
  })

  it.each(sizes)('GlassButton size="%s" has min-w-[44px] class', (size) => {
    const { container } = render(
      <GlassButton size={size}>Test</GlassButton>,
    )
    const btn = container.firstElementChild as HTMLElement
    const classes = btn.className
    expect(classes).toContain('min-w-[44px]')
  })

  it('touch target classes are on the button element itself, not a wrapper', () => {
    const { container } = render(
      <GlassButton size="sm">Test</GlassButton>,
    )
    const btn = container.querySelector('button')
    expect(btn).not.toBeNull()
    expect(btn!.className).toContain('min-h-[44px]')
    expect(btn!.className).toContain('min-w-[44px]')
  })
})
