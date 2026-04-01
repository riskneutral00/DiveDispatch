// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '../helpers/render'
import { FullPageSpinner } from '@/components/ui/full-page-spinner'

describe('FullPageSpinner', () => {
  it('applies default full-screen layout class', () => {
    const { container } = render(<FullPageSpinner />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('min-h-screen')
    expect(wrapper.className).toContain('items-center')
  })

  it('passes label to Spinner when provided', () => {
    render(<FullPageSpinner label="Loading…" />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('allows custom wrapper className', () => {
    const { container } = render(<FullPageSpinner className="custom-wrap" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('custom-wrap')
  })
})
