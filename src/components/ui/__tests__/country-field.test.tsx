// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CountryField } from '../country-field'

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
}))

describe('CountryField', () => {
  it('renders an option for United States with ISO-2 code value', () => {
    render(<CountryField label="Country" value="" onChange={() => {}} />)
    const option = screen.getByRole('option', { name: /United States/i }) as HTMLOptionElement
    expect(option.value).toBe('US')
  })

  it('emits ISO-2 code on change', () => {
    const onChange = vi.fn()
    render(<CountryField label="Country" value="" onChange={onChange} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'TH' } })
    expect(onChange).toHaveBeenCalledWith('TH')
  })

  it('passes the required prop through', () => {
    render(<CountryField label="Country" value="" onChange={() => {}} required />)
    expect((screen.getByRole('combobox') as HTMLSelectElement).required).toBe(true)
  })
})
