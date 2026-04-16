// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyThemeBootstrap,
  BOOTSTRAP_APPLIED_VARS_GLOBAL,
  BOOTSTRAP_DEFAULT_LUMINANCE,
  BOOTSTRAP_DEFAULT_MODE,
  BOOTSTRAP_DEFAULT_THEME_ID,
  getThemeBootstrapScript,
  THEME_META_STORAGE_KEY,
  THEME_MODE_STORAGE_KEY,
  THEME_VARS_STORAGE_KEY,
} from '../src/themes/theme-bootstrap'

describe('applyThemeBootstrap', () => {
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
    const root = document.documentElement
    root.removeAttribute('data-mode')
    root.removeAttribute('data-theme')
    root.removeAttribute('data-luminance')
    root.style.cssText = ''
    delete (window as unknown as Record<string, unknown>)[
      BOOTSTRAP_APPLIED_VARS_GLOBAL
    ]
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('applies defaults when storage is empty', () => {
    applyThemeBootstrap(window, document)
    const root = document.documentElement
    expect(root.getAttribute('data-mode')).toBe(BOOTSTRAP_DEFAULT_MODE)
    expect(root.getAttribute('data-theme')).toBe(BOOTSTRAP_DEFAULT_THEME_ID)
    expect(root.getAttribute('data-luminance')).toBe(BOOTSTRAP_DEFAULT_LUMINANCE)
    expect(window[BOOTSTRAP_APPLIED_VARS_GLOBAL]).toBeUndefined()
  })

  it('restores mode, theme id, luminance, and CSS vars from cache', () => {
    storage[THEME_MODE_STORAGE_KEY] = 'dark'
    storage[THEME_META_STORAGE_KEY] = JSON.stringify({
      id: 'skin-dark-7',
      luminance: 'dark',
    })
    storage[THEME_VARS_STORAGE_KEY] = JSON.stringify({
      '--color-primary': '#9333ea',
      '--body-bg': '#0b1020',
      '--color-text-primary': '#f5f3ff',
    })

    applyThemeBootstrap(window, document)

    const root = document.documentElement
    expect(root.getAttribute('data-mode')).toBe('dark')
    expect(root.getAttribute('data-theme')).toBe('skin-dark-7')
    expect(root.getAttribute('data-luminance')).toBe('dark')
    expect(root.style.getPropertyValue('--color-primary')).toBe('#9333ea')
    expect(root.style.getPropertyValue('--body-bg')).toBe('#0b1020')
    expect(root.style.getPropertyValue('--color-text-primary')).toBe('#f5f3ff')
    expect(window[BOOTSTRAP_APPLIED_VARS_GLOBAL]).toEqual({
      '--color-primary': '#9333ea',
      '--body-bg': '#0b1020',
      '--color-text-primary': '#f5f3ff',
    })
  })

  it('coerces unknown mode values to the default', () => {
    storage[THEME_MODE_STORAGE_KEY] = 'chartreuse'
    applyThemeBootstrap(window, document)
    expect(document.documentElement.getAttribute('data-mode')).toBe(
      BOOTSTRAP_DEFAULT_MODE,
    )
  })

  it('falls back silently when cache JSON is corrupted', () => {
    storage[THEME_MODE_STORAGE_KEY] = 'light'
    storage[THEME_VARS_STORAGE_KEY] = '{not-json'
    storage[THEME_META_STORAGE_KEY] = '{also-not-json'

    expect(() => applyThemeBootstrap(window, document)).not.toThrow()

    const root = document.documentElement
    expect(root.getAttribute('data-mode')).toBe('light')
    expect(root.getAttribute('data-theme')).toBe(BOOTSTRAP_DEFAULT_THEME_ID)
    expect(root.getAttribute('data-luminance')).toBe(BOOTSTRAP_DEFAULT_LUMINANCE)
    expect(window[BOOTSTRAP_APPLIED_VARS_GLOBAL]).toBeUndefined()
  })

  it('ignores non-string values in the vars map', () => {
    storage[THEME_VARS_STORAGE_KEY] = JSON.stringify({
      '--color-primary': '#9333ea',
      '--glass-blur': 14,
      '--bogus': null,
    })
    applyThemeBootstrap(window, document)
    const root = document.documentElement
    expect(root.style.getPropertyValue('--color-primary')).toBe('#9333ea')
    expect(root.style.getPropertyValue('--glass-blur')).toBe('')
    expect(root.style.getPropertyValue('--bogus')).toBe('')
    expect(window[BOOTSTRAP_APPLIED_VARS_GLOBAL]).toEqual({
      '--color-primary': '#9333ea',
    })
  })
})

describe('getThemeBootstrapScript', () => {
  it('references all storage keys and defaults', () => {
    const src = getThemeBootstrapScript()
    expect(src).toContain(THEME_MODE_STORAGE_KEY)
    expect(src).toContain(THEME_VARS_STORAGE_KEY)
    expect(src).toContain(THEME_META_STORAGE_KEY)
    expect(src).toContain(BOOTSTRAP_DEFAULT_THEME_ID)
    expect(src).toContain(BOOTSTRAP_DEFAULT_MODE)
    expect(src).toContain(BOOTSTRAP_DEFAULT_LUMINANCE)
    expect(src).toContain(BOOTSTRAP_APPLIED_VARS_GLOBAL)
  })

  it('returns a self-invoking IIFE', () => {
    const src = getThemeBootstrapScript()
    expect(src.startsWith('(function(')).toBe(true)
    expect(src.endsWith(');')).toBe(true)
  })

  it('contains no </script> sequence that would break SSR inlining', () => {
    expect(getThemeBootstrapScript()).not.toContain('</script>')
  })
})
