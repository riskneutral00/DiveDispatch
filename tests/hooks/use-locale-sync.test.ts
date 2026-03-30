// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockRefresh = vi.fn()
const mockUseCurrentUser = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

vi.mock('../../src/lib/hooks/use-current-user', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}))

import { useLocaleSync } from '../../src/lib/hooks/use-locale-sync'

describe('useLocaleSync', () => {
  beforeEach(() => {
    mockRefresh.mockClear()
    // Reset cookie
    document.cookie = 'dd-locale=; max-age=0'
  })

  afterEach(() => {
    document.cookie = 'dd-locale=; max-age=0'
  })

  it('does nothing when user is null', () => {
    mockUseCurrentUser.mockReturnValue({ user: null })
    renderHook(() => useLocaleSync())
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('sets cookie and refreshes when cookie differs from user locale', () => {
    mockUseCurrentUser.mockReturnValue({ user: { appLanguage: 'th' } })
    renderHook(() => useLocaleSync())
    expect(document.cookie).toContain('dd-locale=th')
    expect(mockRefresh).toHaveBeenCalledOnce()
  })

  it('does not refresh when cookie matches user locale', () => {
    document.cookie = 'dd-locale=en; path=/'
    mockUseCurrentUser.mockReturnValue({ user: { appLanguage: 'en' } })
    renderHook(() => useLocaleSync())
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('falls back to default locale when appLanguage is null', () => {
    mockUseCurrentUser.mockReturnValue({ user: { appLanguage: null } })
    renderHook(() => useLocaleSync())
    expect(document.cookie).toContain('dd-locale=en')
  })

  it('falls back to default locale for unsupported locale', () => {
    mockUseCurrentUser.mockReturnValue({ user: { appLanguage: 'xx' } })
    renderHook(() => useLocaleSync())
    expect(document.cookie).toContain('dd-locale=en')
  })
})
