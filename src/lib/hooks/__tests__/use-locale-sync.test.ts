// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockCurrentUser = vi.fn<() => { user: Record<string, unknown> | null; isLoading: boolean }>()
vi.mock('@/lib/hooks/use-current-user', () => ({
  useCurrentUser: () => mockCurrentUser(),
}))

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

import { useLocaleSync } from '../use-locale-sync'

function getCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
    ?.split('=')[1]
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRefresh.mockClear()
  clearCookie('dd-locale')
})

afterEach(() => {
  clearCookie('dd-locale')
})

describe('useLocaleSync', () => {
  it('sets cookie from user.appLanguage when supported', () => {
    mockCurrentUser.mockReturnValue({
      user: { appLanguage: 'th' },
      isLoading: false,
    })
    renderHook(() => useLocaleSync())
    expect(getCookie('dd-locale')).toBe('th')
  })

  it('falls back to DEFAULT_LOCALE when appLanguage is absent', () => {
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
    document.cookie = 'dd-locale=ko; path=/'
    const spy = vi.spyOn(document, 'cookie', 'set')

    mockCurrentUser.mockReturnValue({
      user: { appLanguage: 'ko' },
      isLoading: false,
    })
    renderHook(() => useLocaleSync())

    expect(spy).not.toHaveBeenCalled()
    expect(mockRefresh).not.toHaveBeenCalled()
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

  it('calls router.refresh() when cookie is stale', () => {
    document.cookie = 'dd-locale=en; path=/'
    mockCurrentUser.mockReturnValue({
      user: { appLanguage: 'th' },
      isLoading: false,
    })
    renderHook(() => useLocaleSync())

    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(getCookie('dd-locale')).toBe('th')
  })

  it('calls router.refresh() when cookie is absent', () => {
    mockCurrentUser.mockReturnValue({
      user: { appLanguage: 'zh-CN' },
      isLoading: false,
    })
    renderHook(() => useLocaleSync())

    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(getCookie('dd-locale')).toBe('zh-CN')
  })

  it.each([
    ['ko-KR', 'ko'],
    ['fr-FR', 'fr'],
    ['th-TH', 'th'],
    ['en-GB', 'en'],
    ['en-US', 'en'],
  ])('strips BCP-47 region from %s to %s', (raw, expected) => {
    mockCurrentUser.mockReturnValue({
      user: { appLanguage: raw },
      isLoading: false,
    })
    renderHook(() => useLocaleSync())
    expect(getCookie('dd-locale')).toBe(expected)
  })

  it('preserves zh-CN and zh-TW (both supported distinctly)', () => {
    mockCurrentUser.mockReturnValue({
      user: { appLanguage: 'zh-TW' },
      isLoading: false,
    })
    renderHook(() => useLocaleSync())
    expect(getCookie('dd-locale')).toBe('zh-TW')
  })
})
