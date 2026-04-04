// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Card } from '@/components/ui/card'

describe('Card', () => {
  it('renders with glass-container class, not glass or glass-elevated', () => {
    const { container } = render(<Card>Content</Card>)
    const el = container.firstElementChild!
    expect(el.className).toContain('glass-container')
    expect(el.className).not.toContain('glass-elevated')
    // "glass-container" contains "glass" as a substring, so check for exact standalone class
    const classes = el.className.split(' ')
    expect(classes).not.toContain('glass')
  })

  it('hoverable adds glass-surface class', () => {
    const { container } = render(<Card hoverable>Content</Card>)
    const el = container.firstElementChild!
    expect(el.className).toContain('glass-surface')
    expect(el.className).toContain('cursor-pointer')
  })

  it('applies padding variants', () => {
    const { container: none } = render(<Card padding="none">X</Card>)
    const { container: sm } = render(<Card padding="sm">X</Card>)
    const { container: lg } = render(<Card padding="lg">X</Card>)
    expect(none.firstElementChild!.className).not.toContain('p-')
    expect(sm.firstElementChild!.className).toContain('p-3')
    expect(lg.firstElementChild!.className).toContain('p-6')
  })

  it('renders as custom element via as prop', () => {
    const { container } = render(<Card as="section">Content</Card>)
    expect(container.firstElementChild!.tagName).toBe('SECTION')
  })
})
