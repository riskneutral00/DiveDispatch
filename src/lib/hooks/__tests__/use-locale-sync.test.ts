// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCurrentUser = vi.fn<() => { user: Record<string, unknown> | null; isLoading: boolean }>()
vi.mock('@/lib/hooks/use-current-user', () => ({
  useCurrentUser: () => mockCurrentUser(),
}))

// Import AFTER mocks
import { useLocaleSync } from '../use-locale-sync'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
    ?.split('=')[1]
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  clearCookie('dd-locale')
})

afterEach(() => {
  clearCookie('dd-locale')
})

describe('useLocaleSync', () => {
  it('sets cookie from user.appLanguage when supported', () => {
    mockCurrentUser.mockReturnValue({
      user: { appLanguage: 'th', preferredLocale: 'fr' },
      isLoading: false,
    })
    renderHook(() => useLocaleSync())
    expect(getCookie('dd-locale')).toBe('th')
  })

  it('falls back to preferredLocale when appLanguage is absent', () => {
    mockCurrentUser.mockReturnValue({
      user: { preferredLocale: 'fr' },
      isLoading: false,
    })
    renderHook(() => useLocaleSync())
    expect(getCookie('dd-locale')).toBe('fr')
  })

  it('falls back to DEFAULT_LOCALE when both are absent', () => {
    mockCurrentUser.mockReturnValue({
      user: { slug: 'test-user' },
      isLoading: false,
    })
    renderHook(() => useLocaleSync())
    expect(getCookie('dd-locale')).toBe('en')
  })

  it('defaults unsupported locale to en', () => {
    mockCurrentUser.mockReturnValue({
      user: { appLanguage: 'xx-UNSUPPORTED' },
      isLoading: false,
    })
    renderHook(() => useLocaleSync())
    expect(getCookie('dd-locale')).toBe('en')
  })

  it('does not set cookie when user is null', () => {
    mockCurrentUser.mockReturnValue({ user: null, isLoading: true })
    renderHook(() => useLocaleSync())
    expect(getCookie('dd-locale')).toBeUndefined()
  })

  it('does not rewrite cookie when value already matches', () => {
    // Pre-set the cookie
    document.cookie = 'dd-locale=ko; path=/'
    const spy = vi.spyOn(document, 'cookie', 'set')

    mockCurrentUser.mockReturnValue({
      user: { appLanguage: 'ko' },
      isLoading: false,
    })
    renderHook(() => useLocaleSync())

    // Cookie setter should not have been called since value matches
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('overwrites stale cookie with new locale', () => {
    document.cookie = 'dd-locale=fr; path=/'
    mockCurrentUser.mockReturnValue({
      user: { appLanguage: 'zh-CN' },
      isLoading: false,
    })
    renderHook(() => useLocaleSync())
    expect(getCookie('dd-locale')).toBe('zh-CN')
  })
})
