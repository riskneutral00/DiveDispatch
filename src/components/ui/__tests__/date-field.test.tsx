// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render as rawRender, screen } from '@testing-library/react'
import { render } from '../../../../tests/helpers/render'
import { DateField } from '../date-field'
import { BirthdayField } from '../birthday-field'

describe('DateField', () => {
  it('renders segments with label and required asterisk', () => {
    const { container } = rawRender(
      <DateField label="Date" value={null} onChange={() => {}} required />,
    )
    expect(screen.getByText(/Date/i)).toBeTruthy()
    expect(container.textContent).toMatch(/\*/)
  })

  it('parses and displays an ISO value', () => {
    rawRender(<DateField label="Date" value="1990-06-15" onChange={() => {}} />)
    expect(screen.getByRole('group')).toBeTruthy()
  })

  it('ignores invalid ISO strings without throwing', () => {
    expect(() =>
      rawRender(<DateField label="Date" value="not-a-date" onChange={() => {}} />),
    ).not.toThrow()
  })

  it('shows error message', () => {
    rawRender(
      <DateField
        label="Date"
        value={null}
        onChange={() => {}}
        error="Required"
      />,
    )
    expect(screen.getByRole('alert').textContent).toBe('Required')
  })
})

describe('BirthdayField', () => {
  it('renders three selects with legend label', () => {
    const { container } = render(
      <BirthdayField label="Birthday" value={null} onChange={() => {}} />,
    )
    expect(screen.getByText(/Birthday/i)).toBeTruthy()
    expect(container.querySelectorAll('select').length).toBe(3)
  })

  it('pre-fills selects from a valid ISO birthdate', () => {
    const { container } = render(
      <BirthdayField
        label="Birthday"
        value="1988-03-22"
        onChange={() => {}}
      />,
    )
    const selects = container.querySelectorAll<HTMLSelectElement>('select')
    expect(selects[0].value).toBe('1988')
    expect(selects[1].value).toBe('03')
    expect(selects[2].value).toBe('22')
  })

  it('renders the required asterisk when required', () => {
    const { container } = render(
      <BirthdayField label="Birthday" value={null} onChange={() => {}} required />,
    )
    expect(container.textContent).toMatch(/\*/)
  })

  it('emits null when any part is unset', () => {
    const onChange = vi.fn()
    const { container } = render(
      <BirthdayField label="Birthday" value="1988-03-22" onChange={onChange} />,
    )
    const year = container.querySelectorAll<HTMLSelectElement>('select')[0]
    year.value = ''
    year.dispatchEvent(new Event('change', { bubbles: true }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('keeps partial picks in the selects when parent value is null', () => {
    const onChange = vi.fn()
    const { container, rerender } = render(
      <BirthdayField label="Birthday" value={null} onChange={onChange} />,
    )
    const [yearSelect, monthSelect] = container.querySelectorAll<HTMLSelectElement>('select')

    yearSelect.value = '1998'
    yearSelect.dispatchEvent(new Event('change', { bubbles: true }))
    expect(onChange).toHaveBeenLastCalledWith(null)

    rerender(<BirthdayField label="Birthday" value={null} onChange={onChange} />)
    expect(yearSelect.value).toBe('1998')

    monthSelect.value = '03'
    monthSelect.dispatchEvent(new Event('change', { bubbles: true }))
    expect(onChange).toHaveBeenLastCalledWith(null)

    rerender(<BirthdayField label="Birthday" value={null} onChange={onChange} />)
    expect(yearSelect.value).toBe('1998')
    expect(monthSelect.value).toBe('03')
  })

  it('emits ISO once all three parts are set', () => {
    const onChange = vi.fn()
    const { container } = render(
      <BirthdayField label="Birthday" value={null} onChange={onChange} />,
    )
    const [yearSelect, monthSelect, daySelect] = container.querySelectorAll<HTMLSelectElement>('select')

    yearSelect.value = '1998'
    yearSelect.dispatchEvent(new Event('change', { bubbles: true }))
    monthSelect.value = '03'
    monthSelect.dispatchEvent(new Event('change', { bubbles: true }))
    daySelect.value = '22'
    daySelect.dispatchEvent(new Event('change', { bubbles: true }))

    expect(onChange).toHaveBeenLastCalledWith('1998-03-22')
  })

  it('syncs selects when the value prop changes externally', () => {
    const onChange = vi.fn()
    const { container, rerender } = render(
      <BirthdayField label="Birthday" value="1988-03-22" onChange={onChange} />,
    )
    rerender(<BirthdayField label="Birthday" value="1990-11-05" onChange={onChange} />)
    const selects = container.querySelectorAll<HTMLSelectElement>('select')
    expect(selects[0].value).toBe('1990')
    expect(selects[1].value).toBe('11')
    expect(selects[2].value).toBe('05')
  })
})
