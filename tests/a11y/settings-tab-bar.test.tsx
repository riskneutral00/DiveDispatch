// @vitest-environment jsdom
/**
 * SettingsTabBar: WAI-ARIA tabs keyboard navigation
 *
 * Verifies roving tabindex and ArrowLeft/Right keyboard navigation
 * per the WAI-ARIA tabs pattern.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '../helpers/render'
import { SettingsTabBar, type TabItem } from '@/components/settings/settings-tab-bar'

const TABS: TabItem[] = [
  { id: 'general', label: 'General' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'privacy', label: 'Privacy' },
]

describe('SettingsTabBar: roving tabindex', () => {
  it('active tab has tabIndex 0, inactive tabs have tabIndex -1', () => {
    const { getAllByRole } = render(
      <SettingsTabBar tabs={TABS} activeTab="notifications" onChange={vi.fn()} />,
    )
    const tabs = getAllByRole('tab')

    expect(tabs[0].getAttribute('tabindex')).toBe('-1')
    expect(tabs[1].getAttribute('tabindex')).toBe('0')
    expect(tabs[2].getAttribute('tabindex')).toBe('-1')
  })
})

describe('SettingsTabBar: arrow key navigation', () => {
  it('ArrowRight moves focus and activates the next tab', () => {
    const onChange = vi.fn()
    const { getAllByRole } = render(
      <SettingsTabBar tabs={TABS} activeTab="general" onChange={onChange} />,
    )
    const tabs = getAllByRole('tab')

    // Focus the active tab and press ArrowRight
    tabs[0].focus()
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' })

    expect(onChange).toHaveBeenCalledWith('notifications')
  })

  it('ArrowLeft moves focus and activates the previous tab', () => {
    const onChange = vi.fn()
    const { getAllByRole } = render(
      <SettingsTabBar tabs={TABS} activeTab="notifications" onChange={onChange} />,
    )
    const tabs = getAllByRole('tab')

    tabs[1].focus()
    fireEvent.keyDown(tabs[1], { key: 'ArrowLeft' })

    expect(onChange).toHaveBeenCalledWith('general')
  })

  it('ArrowRight wraps from last tab to first', () => {
    const onChange = vi.fn()
    const { getAllByRole } = render(
      <SettingsTabBar tabs={TABS} activeTab="privacy" onChange={onChange} />,
    )
    const tabs = getAllByRole('tab')

    tabs[2].focus()
    fireEvent.keyDown(tabs[2], { key: 'ArrowRight' })

    expect(onChange).toHaveBeenCalledWith('general')
  })

  it('ArrowLeft wraps from first tab to last', () => {
    const onChange = vi.fn()
    const { getAllByRole } = render(
      <SettingsTabBar tabs={TABS} activeTab="general" onChange={onChange} />,
    )
    const tabs = getAllByRole('tab')

    tabs[0].focus()
    fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' })

    expect(onChange).toHaveBeenCalledWith('privacy')
  })
})
