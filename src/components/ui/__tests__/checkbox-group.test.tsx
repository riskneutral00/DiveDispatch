// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CheckboxGroup } from '../checkbox-group'

const ITEMS = [
  { value: 'air', label: 'Air' },
  { value: 'nitrox', label: 'Nitrox' },
]

function getFieldset(container: HTMLElement): HTMLFieldSetElement {
  const fieldset = container.querySelector('fieldset')
  if (!fieldset) throw new Error('fieldset missing')
  return fieldset as HTMLFieldSetElement
}

function getLegend(container: HTMLElement): HTMLLegendElement {
  const legend = container.querySelector('legend')
  if (!legend) throw new Error('legend missing')
  return legend as HTMLLegendElement
}

describe('CheckboxGroup', () => {
  it('renders <fieldset> with reading-plane wrapper class', () => {
    const { container } = render(
      <CheckboxGroup label="Gas Mixes" items={ITEMS} selected={[]} onChange={vi.fn()} />,
    )
    const fieldset = getFieldset(container)
    expect(fieldset.className).toContain('reading-plane')
  })

  it('renders required asterisk inside legend when required=true and hideLabel is not set', () => {
    const { container } = render(
      <CheckboxGroup label="Gas Mixes" items={ITEMS} selected={[]} onChange={vi.fn()} required />,
    )
    const legend = getLegend(container)
    const asterisk = legend.querySelector('[aria-hidden="true"]')
    expect(asterisk).not.toBeNull()
    expect(asterisk!.textContent).toContain('*')
  })

  it('hideLabel=true preserves accessible group name "Gas Mixes" via sr-only legend', () => {
    const { container } = render(
      <CheckboxGroup label="Gas Mixes" items={ITEMS} selected={[]} onChange={vi.fn()} hideLabel />,
    )
    const group = screen.getByRole('group', { name: 'Gas Mixes' })
    expect(group).not.toBeNull()
    expect(group.tagName).toBe('FIELDSET')

    const legend = getLegend(container)
    expect(legend.className).toContain('sr-only')
  })

  it('hideLabel=true with required=true does NOT render asterisk (sr-only legend hides decorative glyph)', () => {
    const { container } = render(
      <CheckboxGroup
        label="Gas Mixes"
        items={ITEMS}
        selected={[]}
        onChange={vi.fn()}
        required
        hideLabel
      />,
    )
    const legend = getLegend(container)
    expect(legend.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  it('produces grid-cols-1 sm:grid-cols-2 by default', () => {
    const { container } = render(
      <CheckboxGroup label="Gas Mixes" items={ITEMS} selected={[]} onChange={vi.fn()} />,
    )
    const grid = getFieldset(container).querySelector(':scope > div')
    expect(grid).not.toBeNull()
    expect(grid!.className).toContain('grid-cols-1')
    expect(grid!.className).toContain('sm:grid-cols-2')
  })

  it('produces grid-cols-1 sm:grid-cols-3 when columns=3', () => {
    const { container } = render(
      <CheckboxGroup label="Gas Mixes" items={ITEMS} selected={[]} onChange={vi.fn()} columns={3} />,
    )
    const grid = getFieldset(container).querySelector(':scope > div')
    expect(grid).not.toBeNull()
    expect(grid!.className).toContain('grid-cols-1')
    expect(grid!.className).toContain('sm:grid-cols-3')
  })

  it('renders FieldError as a DOM descendant of the fieldset when error is provided', () => {
    const { container } = render(
      <CheckboxGroup
        label="Gas Mixes"
        items={ITEMS}
        selected={[]}
        onChange={vi.fn()}
        error="Pick at least one"
      />,
    )
    const fieldset = getFieldset(container)
    const errorEl = screen.getByRole('alert')
    expect(errorEl.textContent).toContain('Pick at least one')
    expect(fieldset.contains(errorEl)).toBe(true)
  })

  it('toggles selected array (ADD) when an unchecked native checkbox is clicked', () => {
    const onChange = vi.fn()
    render(
      <CheckboxGroup label="Gas Mixes" items={ITEMS} selected={['air']} onChange={onChange} />,
    )
    const inputs = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(inputs).toHaveLength(2)
    fireEvent.click(inputs[1])
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(['air', 'nitrox'])
  })

  it('toggles selected array (REMOVE) when a checked native checkbox is clicked', () => {
    const onChange = vi.fn()
    render(
      <CheckboxGroup
        label="Gas Mixes"
        items={ITEMS}
        selected={['air', 'nitrox']}
        onChange={onChange}
      />,
    )
    const inputs = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(inputs).toHaveLength(2)
    fireEvent.click(inputs[0])
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(['nitrox'])
  })

  it('preserves native checkbox roles (type="checkbox")', () => {
    render(
      <CheckboxGroup label="Gas Mixes" items={ITEMS} selected={[]} onChange={vi.fn()} />,
    )
    const inputs = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(inputs).toHaveLength(2)
    inputs.forEach((input) => {
      expect(input.type).toBe('checkbox')
    })
  })
})
