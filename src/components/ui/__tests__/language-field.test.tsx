// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

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
})
