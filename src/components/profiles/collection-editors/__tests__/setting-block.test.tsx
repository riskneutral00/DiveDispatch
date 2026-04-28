// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../../../tests/helpers/render'
import { SettingBlock } from '../setting-block'

describe('SettingBlock', () => {
  it('renders the section header label', () => {
    render(
      <SettingBlock label="Booking">
        <div>content</div>
      </SettingBlock>,
    )
    expect(screen.getByText('Booking')).toBeInTheDocument()
  })

  it('renders children inside the content slot', () => {
    render(
      <SettingBlock label="Booking">
        <div data-testid="child">child content</div>
      </SettingBlock>,
    )
    expect(screen.getByTestId('child').textContent).toBe('child content')
  })

  it('marks header as required when required prop is set', () => {
    const { container } = render(
      <SettingBlock label="Booking" required>
        <div>x</div>
      </SettingBlock>,
    )
    const aside = container.querySelector('[aria-hidden="true"]')
    expect(aside?.textContent?.trim()).toBe('*')
  })

  it('renders an action element next to the header when provided', () => {
    render(
      <SettingBlock
        label="Booking"
        action={<button type="button">Add</button>}
      >
        <div>x</div>
      </SettingBlock>,
    )
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('applies glass surface styling when surface=glass', () => {
    const { container } = render(
      <SettingBlock label="Booking" surface="glass">
        <div>x</div>
      </SettingBlock>,
    )
    const section = container.querySelector('section')
    expect(section?.className).toMatch(/glass-container/)
  })

  it('does not apply glass surface styling when surface=plain (default)', () => {
    const { container } = render(
      <SettingBlock label="Booking">
        <div>x</div>
      </SettingBlock>,
    )
    const section = container.querySelector('section')
    expect(section?.className).not.toMatch(/glass-container/)
  })
})
