// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SectionDivider } from '../section-divider'

describe('SectionDivider', () => {
  it('renders when show omitted (defaults to true)', () => {
    const { container } = render(<SectionDivider />)
    expect(container.querySelector('hr')).not.toBeNull()
  })

  it('returns null when show=false', () => {
    const { container } = render(<SectionDivider show={false} />)
    expect(container.querySelector('hr')).toBeNull()
  })

  it('default variant does not add soft classes', () => {
    const { container } = render(<SectionDivider />)
    const hr = container.querySelector('hr')
    expect(hr?.className).toContain('form-divider')
    expect(hr?.className).not.toContain('opacity-70')
    expect(hr?.className).not.toContain('my-1')
  })

  it('soft variant layers opacity-70 my-1 on top of form-divider', () => {
    const { container } = render(<SectionDivider variant="soft" />)
    const hr = container.querySelector('hr')
    expect(hr?.className).toContain('form-divider')
    expect(hr?.className).toContain('opacity-70')
    expect(hr?.className).toContain('my-1')
  })

  it('custom className merges after variant classes', () => {
    const { container } = render(
      <SectionDivider variant="soft" className="mt-8" />,
    )
    const hr = container.querySelector('hr')
    expect(hr?.className).toContain('form-divider')
    expect(hr?.className).toContain('opacity-70')
    expect(hr?.className).toContain('mt-8')
  })
})
