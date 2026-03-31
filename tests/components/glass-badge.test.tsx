// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { GlassBadge } from '@/components/ui/glass-badge'

const variants = ['default', 'success', 'warning', 'destructive', 'info'] as const

describe('GlassBadge', () => {
  it.each(variants)('%s variant has no backdropFilter', (variant) => {
    const { container } = render(<GlassBadge variant={variant}>Tag</GlassBadge>)
    const el = container.firstElementChild as HTMLElement
    expect(el.style.backdropFilter).toBe('')
    // @ts-expect-error -- WebkitBackdropFilter is a vendor prefix
    expect(el.style.WebkitBackdropFilter ?? el.style.webkitBackdropFilter ?? '').toBe('')
  })

  it.each(variants)('%s variant keeps colored background', (variant) => {
    const { container } = render(<GlassBadge variant={variant}>Tag</GlassBadge>)
    const el = container.firstElementChild as HTMLElement
    expect(el.style.background).not.toBe('')
  })

  it('renders dot indicator when dot prop is true', () => {
    const { container } = render(<GlassBadge dot>Status</GlassBadge>)
    const dots = container.querySelectorAll('.rounded-full')
    expect(dots.length).toBeGreaterThanOrEqual(1)
  })
})
