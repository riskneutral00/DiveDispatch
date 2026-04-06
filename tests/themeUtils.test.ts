import { describe, it, expect } from 'vitest'
import { contrastRatio, meetsAA, meetsAAA, paletteToVars, themeToVars } from '../src/themes/theme-utils'
import type { ColorPalette, ThemeConfig } from '../src/themes/theme-types'

const palette: ColorPalette = {
  primary: '#0891b2',
  secondary: '#065f73',
  accent: '#22d3ee',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textOnPrimary: '#ffffff',
  glassBg: 'rgba(0,0,0,0.3)',
  glassBorder: 'rgba(255,255,255,0.1)',
  glassBlur: 12,
  success: '#22c55e',
  warning: '#f59e0b',
  destructive: '#ef4444',
  surface: '#0f172a',
  surfaceElevated: '#1e293b',
  primaryGlow: 'rgba(8,145,178,0.3)',
  glassBgElevated: 'rgba(0,0,0,0.5)',
  glassBorderElevated: 'rgba(255,255,255,0.15)',
  glassBlurElevated: 16,
  glassSpecular: 'rgba(255,255,255,0.08)',
  glassSpecularSubtle: 'rgba(255,255,255,0.04)',
  glassShadow: 'rgba(0,0,0,0.3)',
  glassShadowElevated: 'rgba(0,0,0,0.5)',
  glassBgHover: 'rgba(0,0,0,0.4)',
  glassBorderHover: 'rgba(255,255,255,0.15)',
  glassBlurHover: 14,
  bodyBg: '#0a0e1a',
  luminanceClass: 'dark',
  glassContainerBorder: 'rgba(255,255,255,0.06)',
  glassContainerBg: 'rgba(0,0,0,0.2)',
  opacityWatermark: 0.18,
  opacitySubtle: 0.14,
  opacityMuted: 0.5,
  statusActive: '#22d3ee',
  statusDraft: '#f59e0b',
  statusUpcoming: '#3b82f6',
  statusCompleted: '#22c55e',
  statusCancelled: '#ef4444',
  statusUrgent: '#f43f5e',
  statusBlocked: '#6366f1',
  statusMultidayBorder: '#8b5cf6',
  tooltipBg: 'rgba(255, 255, 255, 0.92)',
  tooltipText: '#0f172a',
}

describe('contrastRatio', () => {
  it('returns 21 for black on white', () => {
    const ratio = contrastRatio('#000000', '#ffffff')
    expect(ratio).toBeCloseTo(21, 0)
  })

  it('returns 1 for same colors', () => {
    const ratio = contrastRatio('#ff0000', '#ff0000')
    expect(ratio).toBeCloseTo(1, 1)
  })

  it('parses 3-digit hex', () => {
    const ratio = contrastRatio('#000', '#fff')
    expect(ratio).toBeCloseTo(21, 0)
  })

  it('parses rgb() notation', () => {
    const ratio = contrastRatio('rgb(0, 0, 0)', 'rgb(255, 255, 255)')
    expect(ratio).toBeCloseTo(21, 0)
  })

  it('parses rgba() notation', () => {
    const ratio = contrastRatio('rgba(0, 0, 0, 1)', 'rgba(255, 255, 255, 1)')
    expect(ratio).toBeCloseTo(21, 0)
  })

  it('returns null for unparseable color', () => {
    expect(contrastRatio('oklch(50% 0.2 240)', '#000')).toBeNull()
  })
})

describe('meetsAA', () => {
  it('returns true for black on white (21:1)', () => {
    expect(meetsAA('#000000', '#ffffff')).toBe(true)
  })

  it('returns false for low-contrast pair', () => {
    // Light grey on white
    expect(meetsAA('#cccccc', '#ffffff')).toBe(false)
  })

  it('returns true for unparseable colors (graceful fallback)', () => {
    expect(meetsAA('oklch(50% 0.2 240)', '#000')).toBe(true)
  })
})

describe('meetsAAA', () => {
  it('returns true for black on white (21:1)', () => {
    expect(meetsAAA('#000000', '#ffffff')).toBe(true)
  })

  it('returns false for moderate contrast pair', () => {
    // Grey that passes AA but not AAA
    expect(meetsAAA('#767676', '#ffffff')).toBe(false)
  })
})

describe('paletteToVars', () => {
  it('maps primary color to CSS variable', () => {
    const vars = paletteToVars(palette)
    expect(vars['--color-primary']).toBe('#0891b2')
  })

  it('maps glass blur to px value', () => {
    const vars = paletteToVars(palette)
    expect(vars['--glass-blur']).toBe('12px')
  })

  it('includes body-bg', () => {
    const vars = paletteToVars(palette)
    expect(vars['--body-bg']).toBe('#0a0e1a')
  })

  it('includes bgImage when present', () => {
    const withBg = { ...palette, bgImage: 'url(/bg.jpg)' }
    const vars = paletteToVars(withBg)
    expect(vars['--bg-image']).toBe('url(/bg.jpg)')
  })

  it('omits bgImage when undefined', () => {
    const vars = paletteToVars(palette)
    expect(vars['--bg-image']).toBeUndefined()
  })

  it('includes tooltip token CSS variables', () => {
    const vars = paletteToVars(palette)
    expect(vars['--color-tooltip-bg']).toBeDefined()
    expect(vars['--color-tooltip-text']).toBeDefined()
  })

  it('tooltip bg differs between dark and bright luminance tiers', () => {
    const brightPalette: ColorPalette = {
      ...palette,
      luminanceClass: 'bright',
      tooltipBg: 'rgba(15, 23, 42, 0.92)',
      tooltipText: '#f8fafc',
    }
    const darkPalette: ColorPalette = {
      ...palette,
      luminanceClass: 'dark',
      tooltipBg: 'rgba(255, 255, 255, 0.92)',
      tooltipText: '#0f172a',
    }
    const darkVars = paletteToVars(darkPalette)
    const brightVars = paletteToVars(brightPalette)
    expect(darkVars['--color-tooltip-bg']).not.toBe(brightVars['--color-tooltip-bg'])
  })
})

describe('themeToVars', () => {
  const theme: ThemeConfig = {
    id: 'test',
    name: 'Test Theme',
    colors: { dark: palette },
    typography: {
      fontHeading: 'Inter',
      fontBody: 'Inter',
      fontAccent: 'Playfair Display',
      headingWeight: 700,
      bodyWeight: 400,
    },
    backgrounds: { fallbackColor: '#111' },
    shape: {
      borderRadius: '12px',
      borderRadiusButton: '999px',
      buttonStyle: 'pill',
      dividerStyle: 'line',
      iconStyle: 'outlined',
    },
    motion: {
      transitionSpeed: 'fast',
      hoverEffect: 'glow',
      pageTransition: 'fade',
      ambientAnimation: 'none',
    },
  }

  it('includes typography vars', () => {
    const vars = themeToVars(theme, 'dark')
    expect(vars['--font-heading']).toBe('Inter')
    expect(vars['--font-body']).toBe('Inter')
    expect(vars['--font-accent']).toBe('Playfair Display')
  })

  it('includes shape vars', () => {
    const vars = themeToVars(theme, 'dark')
    expect(vars['--border-radius']).toBe('12px')
  })

  it('maps fast transition speed to 0.15s', () => {
    const vars = themeToVars(theme, 'dark')
    expect(vars['--transition-speed']).toBe('0.15s')
  })

  it('maps normal transition speed to 0.3s', () => {
    const normalTheme = {
      ...theme,
      motion: { ...theme.motion, transitionSpeed: 'normal' as const },
    }
    const vars = themeToVars(normalTheme, 'dark')
    expect(vars['--transition-speed']).toBe('0.3s')
  })

  it('maps slow transition speed to 0.5s', () => {
    const slowTheme = {
      ...theme,
      motion: { ...theme.motion, transitionSpeed: 'slow' as const },
    }
    const vars = themeToVars(slowTheme, 'dark')
    expect(vars['--transition-speed']).toBe('0.5s')
  })

  it('uses light palette when mode is light and light palette exists', () => {
    const lightPalette = { ...palette, primary: '#ff0000' }
    const themeWithLight: ThemeConfig = {
      ...theme,
      colors: { dark: palette, light: lightPalette },
    }
    const vars = themeToVars(themeWithLight, 'light')
    expect(vars['--color-primary']).toBe('#ff0000')
  })

  it('falls back to dark palette when mode is light but no light palette', () => {
    const vars = themeToVars(theme, 'light')
    expect(vars['--color-primary']).toBe('#0891b2')
  })
})
