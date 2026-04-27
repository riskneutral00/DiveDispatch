// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

import { LanguageField } from '../language-field'

describe('LanguageField', () => {
  it('renders the required asterisk by default (no required prop passed)', () => {
    const { container } = render(
      <LanguageField label="Languages" value={[]} onChange={() => {}} />,
    )
    const label = container.querySelector('label')
    expect(label).not.toBeNull()
    expect(label?.textContent).toContain('*')
  })

  it('omits the asterisk when required={false}', () => {
    const { container } = render(
      <LanguageField
        label="Languages"
        required={false}
        value={[]}
        onChange={() => {}}
      />,
    )
    const label = container.querySelector('label')
    expect(label).not.toBeNull()
    expect(label?.textContent).not.toContain('*')
  })

  it('shows a max of 1 when multiple={false}', () => {
    const { container } = render(
      <LanguageField label="App Language" multiple={false} value={[]} onChange={() => {}} />,
    )
    expect(container.textContent).toContain('0 / 1')
  })

  it('calls onChange([]) when deselecting in single-select mode (multiple={false})', () => {
    const onChange = vi.fn()
    const selected = { code: 'zh-CN', label: 'Mandarin' }
    const { getByRole } = render(
      <LanguageField label="App Language" multiple={false} value={[selected]} onChange={onChange} />,
    )
    fireEvent.click(getByRole('button', { name: 'Mandarin' }))
    expect(onChange).toHaveBeenCalledWith([])
  })
})
