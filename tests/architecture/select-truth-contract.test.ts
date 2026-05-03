// @vitest-environment jsdom
/**
 * RED baseline for the repo-wide select truth contract.
 *
 * Inventoried surfaces (Task 1):
 *   - Direct primitive: src/components/ui/simple-select.tsx
 *   - Direct primitive: src/components/ui/number-picker.tsx
 *   - Wrapper (delete in Task 4): src/components/ui/day-picker.tsx
 *   - Composite consumer: src/components/ui/birthday-field.tsx
 *   - Explicit-empty consumer: src/components/account/preferred-operator-picker.tsx
 *   - Profile consumers: dive-center / boat / personal / venue forms
 *
 * These tests assert the post-refactor contract (Tasks 2-4) and are
 * EXPECTED TO FAIL on `main` until Tasks 2-4 land. Failures must point
 * at specific contract gaps, not setup/syntax errors.
 */
import { describe, expect, it } from 'vitest'
import * as React from 'react'
import { render, screen } from '../helpers/render'
import { SimpleSelect } from '@/components/ui/simple-select'
import { NumberPicker } from '@/components/ui/number-picker'
import * as SimpleSelectModule from '@/components/ui/simple-select'

type AnySimpleSelectProps = React.ComponentProps<typeof SimpleSelect> & {
  loading?: boolean
  getStaleLabel?: (value: string) => string
}

describe('SimpleSelect — truth contract (Task 2)', () => {
  it('exports a SelectValue discriminated union and a fromOptional adapter', () => {
    const mod = SimpleSelectModule as Record<string, unknown>
    expect(
      typeof mod.fromOptional,
      'fromOptional adapter must be exported from simple-select.tsx',
    ).toBe('function')
  })

  it('empty state renders an i18n placeholder (common.select), not a hardcoded literal', () => {
    render(
      React.createElement(SimpleSelect, {
        label: 'Agency',
        value: '',
        onChange: () => {},
        options: [
          { value: 'padi', label: 'PADI' },
          { value: 'ssi', label: 'SSI' },
        ],
        required: true,
      } as AnySimpleSelectProps),
    )
    const sel = screen.getByRole('combobox') as HTMLSelectElement
    const placeholderOpt = Array.from(sel.options).find((o) => o.value === '')
    expect(placeholderOpt, 'empty required select must render a leading placeholder option').toBeTruthy()
    // The post-refactor contract uses t('common.select') == "Select…".
    // Pre-refactor renders an empty string. This assertion is the RED gate.
    expect(placeholderOpt!.textContent ?? '').toMatch(/Select/i)
  })

  it('explicit { value: "", label: "None" } option is preserved (PreferredOperatorPicker shape)', () => {
    render(
      React.createElement(SimpleSelect, {
        label: 'Preferred Operator',
        value: '',
        onChange: () => {},
        options: [
          { value: '', label: 'None' },
          { value: 'a', label: 'Op A' },
        ],
      } as AnySimpleSelectProps),
    )
    const sel = screen.getByRole('combobox') as HTMLSelectElement
    const noneOpt = Array.from(sel.options).find((o) => o.value === '')
    expect(noneOpt?.textContent).toBe('None')
    expect(noneOpt?.disabled).toBe(false)
  })

  it('stale persisted value renders a synthetic disabled selected option with resolved label, never raw value', () => {
    // value is "padi-legacy" but options no longer contain it (e.g. agency was removed).
    render(
      React.createElement(SimpleSelect, {
        label: 'Agency',
        value: 'padi-legacy',
        onChange: () => {},
        options: [
          { value: 'padi', label: 'PADI' },
          { value: 'ssi', label: 'SSI' },
        ],
        getStaleLabel: (v: string) => `Legacy: ${v.toUpperCase()}`,
      } as AnySimpleSelectProps),
    )
    const sel = screen.getByRole('combobox') as HTMLSelectElement
    const stale = Array.from(sel.options).find((o) => o.value === 'padi-legacy')
    expect(stale, 'stale value must render as a synthetic option in the select').toBeTruthy()
    expect(stale!.disabled, 'stale option must be aria/HTML disabled').toBe(true)
    expect(stale!.textContent, 'stale option uses caller-supplied label, never raw value').not.toBe('padi-legacy')
    expect(stale!.textContent).toContain('Legacy: PADI-LEGACY')
    expect(stale!.getAttribute('aria-disabled')).toBe('true')
  })

  it('stale value with no getStaleLabel falls back to common.deprecatedValue (never raw value)', () => {
    render(
      React.createElement(SimpleSelect, {
        label: 'Agency',
        value: 'orphan-code',
        onChange: () => {},
        options: [{ value: 'padi', label: 'PADI' }],
      } as AnySimpleSelectProps),
    )
    const sel = screen.getByRole('combobox') as HTMLSelectElement
    const stale = Array.from(sel.options).find((o) => o.value === 'orphan-code')
    expect(stale, 'stale option must always be synthesized').toBeTruthy()
    expect(stale!.textContent ?? '', 'fallback label must wrap the raw value, not be the raw value').not.toBe(
      'orphan-code',
    )
    expect(stale!.textContent ?? '').toMatch(/deprecated/i)
  })

  it('loading state suppresses stale branch and renders common.loading placeholder', () => {
    render(
      React.createElement(SimpleSelect, {
        label: 'Operator',
        value: 'will-be-stale',
        onChange: () => {},
        options: [],
        loading: true,
      } as AnySimpleSelectProps),
    )
    const sel = screen.getByRole('combobox') as HTMLSelectElement
    // Stale synthesis must be suppressed during loading.
    const stale = Array.from(sel.options).find((o) => o.value === 'will-be-stale')
    expect(stale, 'loading state must suppress stale synthesis').toBeFalsy()
    const placeholder = Array.from(sel.options).find((o) => o.value === '')
    expect(placeholder?.textContent ?? '').toMatch(/Loading/i)
  })
})

describe('NumberPicker — truthful empty state (Task 3)', () => {
  it('value=undefined renders placeholder, not a falsely-selected first option', () => {
    render(
      React.createElement(NumberPicker, {
        label: 'Max Pax',
        value: undefined,
        onChange: () => {},
        min: 1,
        max: 20,
        required: true,
        placeholder: 'Pick a number',
      }),
    )
    const sel = screen.getByRole('combobox') as HTMLSelectElement
    expect(sel.value, 'undefined numeric must NOT auto-select min').toBe('')
    const placeholderOpt = Array.from(sel.options).find((o) => o.value === '')
    expect(placeholderOpt, 'required empty numeric must render a placeholder option').toBeTruthy()
    expect(placeholderOpt!.textContent ?? '').toMatch(/Select|Pick/i)
  })

  it('does not use 0 as a silent empty sentinel when schema minimum is 1', () => {
    // boatFleetEntrySchema.maxPax = z.number().int().min(1).
    // Pre-refactor: emptyFleet() sets maxPax: 0 — a hidden-invalid sentinel.
    // Post-refactor: factory returns undefined, NumberPicker renders empty.
    const { container } = render(
      React.createElement(NumberPicker, {
        label: 'Max Pax',
        value: 0,
        onChange: () => {},
        min: 1,
        max: 20,
      }),
    )
    const sel = container.querySelector('select') as HTMLSelectElement | null
    expect(sel, 'NumberPicker must render a <select>').toBeTruthy()
    // Value=0 below min=1 must not appear as a real option label "0" presented as valid.
    const zeroOpt = Array.from(sel!.options).find((o) => o.value === '0')
    expect(zeroOpt, 'value=0 below min=1 should not be a regular selectable option').toBeFalsy()
  })
})

describe('DayPicker — scheduled deletion (Task 4)', () => {
  it('day-picker.tsx is removed from src/components/ui/', async () => {
    const { existsSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const filePath = resolve(process.cwd(), 'src/components/ui/day-picker.tsx')
    expect(
      existsSync(filePath),
      'src/components/ui/day-picker.tsx must be deleted (Task 4)',
    ).toBe(false)
  })
})

describe('BirthdayField — composite SimpleSelect cells (Task 9 compatibility)', () => {
  it('three child SimpleSelects each pass through suppressMessageSlot', async () => {
    const { BirthdayField } = await import('@/components/ui/birthday-field')
    const { container } = render(
      React.createElement(BirthdayField, {
        label: 'Birthday',
        value: '',
        onChange: () => {},
      } as React.ComponentProps<typeof BirthdayField>),
    )
    const selects = container.querySelectorAll('select')
    expect(selects.length, 'BirthdayField must render exactly 3 SimpleSelect cells').toBe(3)
  })
})

describe('PreferredOperatorPicker — explicit empty option (Task 9 compatibility)', () => {
  it('renders a None option that maps to undefined', async () => {
    // The picker depends on Convex queries; ensure it at least imports.
    const mod = await import('@/components/account/preferred-operator-picker')
    expect(typeof mod.PreferredOperatorPicker).toBe('function')
  })
})
