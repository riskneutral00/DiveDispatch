// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '../helpers/render'
import { SpecialtyField } from '@/components/profiles/specialty-field'
import {
  AGENCIES,
  AOW_REQUIRED_SPECIALTY_COUNT,
  getMandatorySpecialties,
} from '@/lib/constants/agencies'

const PADI_SPECIALTIES = AGENCIES.PADI.specialties
const PADI_MANDATORY = [...getMandatorySpecialties('PADI')]

const OVERFLOW_LABEL = 'Drift'
const REMOVABLE_OVERFLOW = 'Self-Reliant'

function getMandatoryLabel(): string {
  const code = PADI_MANDATORY[0]
  const spec = PADI_SPECIALTIES.find((s) => s.code === code)
  if (!spec) throw new Error(`mandatory spec ${code} not found`)
  return spec.label
}

function findVisibleSpan(label: string): HTMLElement {
  const matches = screen.getAllByText(label)
  const visible = matches.find(
    (el) => el.tagName === 'SPAN' && !el.closest('[aria-hidden="true"]'),
  )
  if (!visible) throw new Error(`visible <span> for "${label}" not found`)
  return visible
}

function getVisibleRow(): HTMLElement {
  const row = document.body.querySelector(
    '.flex.flex-wrap.items-center',
  ) as HTMLElement | null
  if (!row) throw new Error('visible inline row not found')
  if (row.hasAttribute('aria-hidden')) {
    throw new Error('expected visible row, found aria-hidden measurement layer')
  }
  return row
}

describe('SpecialtyField — mandatory pill semantics', () => {
  it('renders mandatory pills as <span> elements, NOT as <button>', () => {
    render(
      <SpecialtyField agencyCode="PADI" value={[...PADI_MANDATORY]} onChange={vi.fn()} />,
    )
    const visiblePill = findVisibleSpan(getMandatoryLabel())
    expect(visiblePill.tagName).toBe('SPAN')
  })

  it('renders mandatory pills with aria-disabled="true"', () => {
    render(
      <SpecialtyField agencyCode="PADI" value={[...PADI_MANDATORY]} onChange={vi.fn()} />,
    )
    const visiblePill = findVisibleSpan(getMandatoryLabel())
    expect(visiblePill.getAttribute('aria-disabled')).toBe('true')
  })

  it('renders mandatory pills with inline opacity: 0.5 style', () => {
    render(
      <SpecialtyField agencyCode="PADI" value={[...PADI_MANDATORY]} onChange={vi.fn()} />,
    )
    const visiblePill = findVisibleSpan(getMandatoryLabel())
    expect(visiblePill.style.opacity).toBe('0.5')
  })

  it('renders labelTrailing counter with current/required values', () => {
    const value = [
      ...PADI_MANDATORY,
      ...PADI_SPECIALTIES.filter(
        (s) => !s.requiredForAOW && !PADI_MANDATORY.includes(s.code),
      ).slice(0, 1).map((s) => s.code),
    ]
    render(<SpecialtyField agencyCode="PADI" value={value} onChange={vi.fn()} />)
    const counter = screen.getByText(
      new RegExp(`${value.length}\\s*/\\s*${AOW_REQUIRED_SPECIALTY_COUNT}`),
    )
    expect(counter).not.toBeNull()
  })
})

describe('SpecialtyField — overflow + at-max with deterministic widths', () => {
  let originalOffsetWidth: PropertyDescriptor | undefined

  beforeEach(() => {
    originalOffsetWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetWidth',
    )
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get(this: HTMLElement) {
        if (this.classList.contains('flex-wrap')) return 200
        return 80
      },
    })
  })

  afterEach(() => {
    if (originalOffsetWidth) {
      Object.defineProperty(
        HTMLElement.prototype,
        'offsetWidth',
        originalOffsetWidth,
      )
    } else {
      delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth
    }
  })

  it('renders a "More…" overflow button when toggleable pills exceed first row', async () => {
    render(
      <SpecialtyField agencyCode="PADI" value={[...PADI_MANDATORY]} onChange={vi.fn()} />,
    )
    const moreBtn = await waitFor(
      () => screen.getByRole('button', { name: /more/i }),
      { timeout: 1000 },
    )
    expect(moreBtn).not.toBeNull()
  })

  it(`a concrete overflow label "${OVERFLOW_LABEL}" is absent from the visible inline row before dropdown opens, and present inside the dropdown after open`, async () => {
    render(
      <SpecialtyField agencyCode="PADI" value={[...PADI_MANDATORY]} onChange={vi.fn()} />,
    )
    const moreBtn = await waitFor(() =>
      screen.getByRole('button', { name: /more/i }),
    )

    const visibleRow = getVisibleRow()
    expect(within(visibleRow).queryByText(OVERFLOW_LABEL)).toBeNull()

    fireEvent.click(moreBtn)

    const dropdown = moreBtn.parentElement!.querySelector(
      '.absolute',
    ) as HTMLElement | null
    expect(dropdown).not.toBeNull()
    expect(within(dropdown!).getByText(OVERFLOW_LABEL)).not.toBeNull()
  })

  it('at max: an unchecked overflow pill is disabled AND a checked overflow pill remains removable', async () => {
    const toggleableCodes = PADI_SPECIALTIES.filter(
      (s) => !s.requiredForAOW && !PADI_MANDATORY.includes(s.code),
    )
    const slotsLeft = AOW_REQUIRED_SPECIALTY_COUNT - PADI_MANDATORY.length
    const filled = [
      ...PADI_MANDATORY,
      ...toggleableCodes.slice(0, slotsLeft).map((s) => s.code),
    ]
    expect(filled).toHaveLength(AOW_REQUIRED_SPECIALTY_COUNT)

    const checkedCodeInValue = filled[filled.length - 1]
    const checkedSpec = PADI_SPECIALTIES.find((s) => s.code === checkedCodeInValue)!
    const uncheckedSpec = toggleableCodes.find((s) => !filled.includes(s.code))!

    render(<SpecialtyField agencyCode="PADI" value={filled} onChange={vi.fn()} />)

    const moreBtn = await waitFor(() =>
      screen.getByRole('button', { name: /more/i }),
    )
    fireEvent.click(moreBtn)

    const dropdown = moreBtn.parentElement!.querySelector(
      '.absolute',
    ) as HTMLElement
    expect(dropdown).not.toBeNull()

    const findInputByLabel = (label: string): HTMLInputElement | null => {
      const matches = within(dropdown).queryAllByText(label)
      const labelEl = matches.find((el) => el.closest('label')) as HTMLElement | undefined
      if (!labelEl) return null
      const wrapper = labelEl.closest('label') as HTMLLabelElement
      return wrapper.querySelector('input[type="checkbox"]') as HTMLInputElement
    }

    const uncheckedInput = findInputByLabel(uncheckedSpec.label)
    const checkedInput = findInputByLabel(checkedSpec.label)

    expect(uncheckedInput).not.toBeNull()
    expect(uncheckedInput!.disabled).toBe(true)

    expect(checkedInput).not.toBeNull()
    expect(checkedInput!.disabled).toBe(false)
  })

  it(`at max: clicking a checked overflow pill ("${REMOVABLE_OVERFLOW}") fires onChange with that code removed`, async () => {
    const toggleableCodes = PADI_SPECIALTIES.filter(
      (s) => !s.requiredForAOW && !PADI_MANDATORY.includes(s.code),
    ).map((s) => s.code)
    expect(toggleableCodes).toContain(REMOVABLE_OVERFLOW)

    const slotsLeft = AOW_REQUIRED_SPECIALTY_COUNT - PADI_MANDATORY.length
    const filledToggleable = [
      ...toggleableCodes.filter((c) => c !== REMOVABLE_OVERFLOW).slice(0, slotsLeft - 1),
      REMOVABLE_OVERFLOW,
    ]
    const filled = [...PADI_MANDATORY, ...filledToggleable]
    expect(filled).toHaveLength(AOW_REQUIRED_SPECIALTY_COUNT)

    const onChange = vi.fn()
    render(<SpecialtyField agencyCode="PADI" value={filled} onChange={onChange} />)

    const moreBtn = await waitFor(() =>
      screen.getByRole('button', { name: /more/i }),
    )
    fireEvent.click(moreBtn)

    const dropdown = moreBtn.parentElement!.querySelector(
      '.absolute',
    ) as HTMLElement
    expect(dropdown).not.toBeNull()

    const labelEl = within(dropdown).getByText(REMOVABLE_OVERFLOW).closest('label')
    expect(labelEl).not.toBeNull()
    const input = labelEl!.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.disabled).toBe(false)

    fireEvent.click(input)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(
      filled.filter((c) => c !== REMOVABLE_OVERFLOW),
    )
  })
})
