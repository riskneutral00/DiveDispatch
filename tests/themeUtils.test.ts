import { describe, it, expect } from 'vitest'
import {
  blendRgbaOverHex,
  contrastRatio,
  DEFAULT_RESPONSIVE_BREAKPOINT_PX,
  meetsAA,
  meetsAAA,
  mergeResponsiveBackgroundSizeIntoVars,
  paletteToVars,
  resolveThemePalette,
  resolveResponsiveBgSize,
  themeToVars,
} from '../src/themes/theme-utils'
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
  fieldUnderline: 'rgba(255,255,255,0.25)',
  glassDialogBg: 'rgba(0,0,0,0.6)',
  glassDialogBorder: 'rgba(255,255,255,0.12)',
  glassDialogBlur: 20,
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

describe('blendRgbaOverHex', () => {
  it('composites semi-transparent white over dark body', () => {
    expect(blendRgbaOverHex('rgba(255, 255, 255, 0.08)', '#000000')).toBe(
      '#141414',
    )
  })

  it('returns null when foreground is unparseable', () => {
    expect(blendRgbaOverHex('oklch(50% 0.2 240)', '#000000')).toBeNull()
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

  it('includes bgSize when present', () => {
    const withSize = { ...palette, bgSize: 'auto' }
    const vars = paletteToVars(withSize)
    expect(vars['--bg-size']).toBe('auto')
  })

  it('omits --bg-size when bgResponsiveBreakpoint is set (client merges)', () => {
    const responsive = {
      ...palette,
      bgResponsiveBreakpoint: 768,
      bgSize: 'auto',
    }
    const vars = paletteToVars(responsive)
    expect(vars['--bg-size']).toBeUndefined()
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

describe('resolveResponsiveBgSize', () => {
  const base: ColorPalette = {
    ...palette,
    bgResponsiveBreakpoint: 768,
    bgSizeSmallScreens: 'cover',
    bgSizeLargeScreens: 'auto',
  }

  it('returns cover below breakpoint', () => {
    expect(resolveResponsiveBgSize(base, 767)).toBe('cover')
  })

  it('returns auto at and above breakpoint', () => {
    expect(resolveResponsiveBgSize(base, 768)).toBe('auto')
    expect(resolveResponsiveBgSize(base, 1920)).toBe('auto')
  })

  it('uses DEFAULT_RESPONSIVE_BREAKPOINT_PX when breakpoint omitted but fields need fallback', () => {
    const p = {
      ...palette,
      bgSizeSmallScreens: 'cover',
      bgSizeLargeScreens: 'auto',
    } as ColorPalette
    expect(resolveResponsiveBgSize(p, DEFAULT_RESPONSIVE_BREAKPOINT_PX - 1)).toBe(
      'cover',
    )
  })

  it('returns small-screen value when viewportWidth is null', () => {
    expect(resolveResponsiveBgSize(base, null)).toBe('cover')
  })
})

describe('mergeResponsiveBackgroundSizeIntoVars', () => {
  it('sets --bg-size from viewport for responsive palettes', () => {
    const responsivePalette = {
      ...palette,
      bgResponsiveBreakpoint: 768,
      bgSizeSmallScreens: 'cover',
      bgSizeLargeScreens: 'auto',
    }
    const theme: ThemeConfig = {
      id: 'skin-light-0',
      name: 'Harbor',
      appearance: 'light',
      colors: {
        palette: responsivePalette,
        dark: palette,
      },
      typography: {
        fontHeading: 'Inter',
        fontBody: 'Inter',
        headingWeight: 700,
        bodyWeight: 400,
      },
      backgrounds: {},
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
    const vars = { ...paletteToVars(resolveThemePalette(theme)) }
    mergeResponsiveBackgroundSizeIntoVars(vars, theme, 1920)
    expect(vars['--bg-size']).toBe('auto')
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
    const vars = themeToVars(theme)
    expect(vars['--font-heading']).toBe('Inter')
    expect(vars['--font-body']).toBe('Inter')
    expect(vars['--font-accent']).toBe('Playfair Display')
  })

  it('includes shape vars', () => {
    const vars = themeToVars(theme)
    expect(vars['--border-radius']).toBe('12px')
  })

  it('maps fast transition speed to 0.15s', () => {
    const vars = themeToVars(theme)
    expect(vars['--transition-speed']).toBe('0.15s')
  })

  it('maps normal transition speed to 0.3s', () => {
    const normalTheme = {
      ...theme,
      motion: { ...theme.motion, transitionSpeed: 'normal' as const },
    }
    const vars = themeToVars(normalTheme)
    expect(vars['--transition-speed']).toBe('0.3s')
  })

  it('maps slow transition speed to 0.5s', () => {
    const slowTheme = {
      ...theme,
      motion: { ...theme.motion, transitionSpeed: 'slow' as const },
    }
    const vars = themeToVars(slowTheme)
    expect(vars['--transition-speed']).toBe('0.5s')
  })

  it('uses palette when colors.palette is set', () => {
    const palettePrimary = { ...palette, primary: '#ff0000' }
    const themeWithPalette: ThemeConfig = {
      ...theme,
      appearance: 'light',
      colors: { dark: palette, palette: palettePrimary },
    }
    const vars = themeToVars(themeWithPalette)
    expect(vars['--color-primary']).toBe('#ff0000')
  })

  it('uses light branch when appearance is light and colors.light exists (no palette)', () => {
    const lightPalette = { ...palette, primary: '#00ff00' }
    const themeWithLight: ThemeConfig = {
      ...theme,
      appearance: 'light',
      colors: { dark: palette, light: lightPalette },
    }
    const vars = themeToVars(themeWithLight)
    expect(vars['--color-primary']).toBe('#00ff00')
  })

  it('falls back to dark palette when no palette and no matching light branch', () => {
    const vars = themeToVars(theme)
    expect(vars['--color-primary']).toBe('#0891b2')
  })
})
