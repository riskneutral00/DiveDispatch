// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { GlassCard } from '@/components/glass/glass-card'

describe('GlassCard', () => {
  it('renders with glass-container class, not glass or glass-elevated', () => {
    const { container } = render(<GlassCard>Content</GlassCard>)
    const el = container.firstElementChild!
    expect(el.className).toContain('glass-container')
    expect(el.className).not.toContain('glass-elevated')
    // "glass-container" contains "glass" as a substring, so check for exact standalone class
    const classes = el.className.split(' ')
    expect(classes).not.toContain('glass')
  })

  it('hoverable adds glass-surface class', () => {
    const { container } = render(<GlassCard hoverable>Content</GlassCard>)
    const el = container.firstElementChild!
    expect(el.className).toContain('glass-surface')
    expect(el.className).toContain('cursor-pointer')
  })

  it('applies padding variants', () => {
    const { container: none } = render(<GlassCard padding="none">X</GlassCard>)
    const { container: sm } = render(<GlassCard padding="sm">X</GlassCard>)
    const { container: lg } = render(<GlassCard padding="lg">X</GlassCard>)
    expect(none.firstElementChild!.className).not.toContain('p-')
    expect(sm.firstElementChild!.className).toContain('p-3')
    expect(lg.firstElementChild!.className).toContain('p-6')
  })

  it('renders as custom element via as prop', () => {
    const { container } = render(<GlassCard as="section">Content</GlassCard>)
    expect(container.firstElementChild!.tagName).toBe('SECTION')
  })
})
