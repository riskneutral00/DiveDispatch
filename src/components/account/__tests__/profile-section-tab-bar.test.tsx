// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProfileSectionTabBar } from '../profile-section-tab-bar'
import { ROLES } from '@/lib/constants/roles'

describe('ProfileSectionTabBar (Row 2) — never carries aria-required', () => {
  for (const role of ROLES) {
    it(`renders no aria-required on any inner section tab for ${role.label}`, () => {
      render(
        <ProfileSectionTabBar
          tabs={role.profileTabs.map((t) => ({ id: t.id, label: t.label }))}
          activeTab={role.profileTabs[0]?.id ?? ''}
          onChange={() => {}}
        />,
      )
      const tabs = screen.getAllByRole('tab')
      expect(tabs.length).toBe(role.profileTabs.length)
      for (const tab of tabs) {
        expect(tab).not.toHaveAttribute('aria-required', 'true')
        expect(tab.textContent ?? '').not.toContain('*')
      }
    })
  }

  it('Row 2 tabs would carry aria-required if Requirable.required were set (smoke)', () => {
    render(
      <ProfileSectionTabBar
        tabs={[
          { id: 'a', label: 'Alpha', required: true },
          { id: 'b', label: 'Beta' },
        ]}
        activeTab="a"
        onChange={() => {}}
      />,
    )
    const tabs = screen.getAllByRole('tab')
    const alpha = tabs.find((t) => (t.textContent ?? '').includes('Alpha'))
    const beta = tabs.find((t) => (t.textContent ?? '').includes('Beta'))
    expect(alpha).toHaveAttribute('aria-required', 'true')
    expect(beta).not.toHaveAttribute('aria-required', 'true')
  })
})
