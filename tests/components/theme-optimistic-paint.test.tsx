// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'

const mockSelectMutation = vi.fn<(args: { themeId: string }) => Promise<void>>()
const mockInjectVars = vi.fn<(vars: Record<string, string>) => void>()

const STABLE_THEME_DATA = {
  user: { _id: 'u1', selectedThemeId: 'theme-light-1' },
  selectedTheme: { id: 'light1', name: 'Light 1' },
  selectedThemeAppearance: 'light' as const,
  savedSkins: [
    { _id: 'theme-light-1', name: 'Light 1', slug: 'light1', appearance: 'light' as const },
    { _id: 'theme-dark-1', name: 'Dark 1', slug: 'dark1', appearance: 'dark' as const },
  ],
}

// mock-ok: testing client-side React Provider behavior (optimistic paint timing inside setMode/selectTheme callbacks). convex-test cannot exercise the React reconciler hot path that this test asserts on; the assertion is "injectVars runs synchronously inside the callback before any await", which is a client invariant. See DD-498 escape clause.
vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useConvexAuth: () => ({ isAuthenticated: true }),
    useQuery: () => STABLE_THEME_DATA,
    useMutation: () => mockSelectMutation,
  }
})

vi.mock('@/themes/theme-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/themes/theme-utils')>()
  return {
    ...actual,
    injectVars: (vars: Record<string, string>) => mockInjectVars(vars),
  }
})

vi.mock('@/themes/theme-loader', () => ({
  loadGoogleFonts: vi.fn(),
}))

import { ThemeProvider, useTheme } from '@/themes/theme-provider'

const PER_ID_VARS_KEY = 'divedispatch-theme-vars-by-id-v1'

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
)

describe('Change 2: optimistic theme paint', () => {
  let storage: Record<string, string>

  beforeEach(() => {
    storage = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value
      },
      removeItem: (key: string) => {
        delete storage[key]
      },
      clear: () => {
        storage = {}
      },
    })
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-mode')
    document.documentElement.removeAttribute('data-luminance')
    mockSelectMutation.mockReset()
    mockSelectMutation.mockReturnValue(
      new Promise(() => {
        return undefined
      }),
    )
    mockInjectVars.mockReset()
  })

  it('setMode synchronously calls injectVars from per-id cache before awaiting mutation', () => {
    localStorage.setItem(
      PER_ID_VARS_KEY,
      JSON.stringify({
        'theme-dark-1': {
          vars: { '--color-primary': '#000', '--color-bg': '#111' },
          themeSlug: 'dark1',
          mode: 'dark',
          luminance: 'dark',
        },
      }),
    )

    const { result } = renderHook(() => useTheme(), { wrapper })

    mockInjectVars.mockClear()
    mockSelectMutation.mockClear()

    act(() => {
      result.current.setMode('dark')
    })

    expect(mockInjectVars).toHaveBeenCalledWith({
      '--color-primary': '#000',
      '--color-bg': '#111',
    })
    expect(mockSelectMutation).toHaveBeenCalledWith({ themeId: 'theme-dark-1' })

    const injectOrder = mockInjectVars.mock.invocationCallOrder[0]
    const mutationOrder = mockSelectMutation.mock.invocationCallOrder[0]
    expect(injectOrder).toBeLessThan(mutationOrder)
  })

  it('selectTheme synchronously calls injectVars from per-id cache before awaiting mutation', () => {
    localStorage.setItem(
      PER_ID_VARS_KEY,
      JSON.stringify({
        'theme-dark-1': {
          vars: { '--color-primary': '#222' },
          themeSlug: 'dark1',
          mode: 'dark',
          luminance: 'dark',
        },
      }),
    )

    const { result } = renderHook(() => useTheme(), { wrapper })

    mockInjectVars.mockClear()
    mockSelectMutation.mockClear()

    act(() => {
      result.current.selectTheme('theme-dark-1')
    })

    expect(mockInjectVars).toHaveBeenCalledWith({ '--color-primary': '#222' })
    expect(mockSelectMutation).toHaveBeenCalledWith({ themeId: 'theme-dark-1' })

    const injectOrder = mockInjectVars.mock.invocationCallOrder[0]
    const mutationOrder = mockSelectMutation.mock.invocationCallOrder[0]
    expect(injectOrder).toBeLessThan(mutationOrder)
  })

  it('setMode never calls injectVars with cached vars when no cache entry exists for target', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    mockInjectVars.mockClear()
    mockSelectMutation.mockClear()

    act(() => {
      result.current.setMode('dark')
    })

    expect(mockSelectMutation).toHaveBeenCalledWith({ themeId: 'theme-dark-1' })
    const synchronousCalls = mockInjectVars.mock.calls.filter(
      ([vars]) =>
        Object.keys(vars as Record<string, string>).length <= 4,
    )
    expect(synchronousCalls).toHaveLength(0)
  })
})
