import { describe, it, expect } from 'vitest'
import { DEFAULT_THEMES } from '../convex/lib/defaultThemes'
import { blendRgbaOverHex, contrastRatio } from '../src/themes/theme-utils'
import type { ColorPalette } from '../src/themes/theme-types'

function assertContrast(
  label: string,
  fg: string,
  bg: string,
  minRatio: number,
) {
  const ratio = contrastRatio(fg, bg)
  if (ratio === null) return
  expect(ratio, `${label}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1 (need ${minRatio}:1)`).toBeGreaterThanOrEqual(minRatio)
}

describe('Skin WCAG contrast compliance', () => {
  for (const skin of DEFAULT_THEMES) {
    const modes: Array<{ name: string; palette: ColorPalette | undefined }> = [
      { name: 'dark', palette: skin.colors.dark },
      { name: 'light', palette: skin.colors.light },
    ]

    for (const { name, palette } of modes) {
      if (!palette) continue

      describe(`${skin.name} / ${name}`, () => {
        it('textPrimary vs surface meets AA (4.5:1)', () => {
          assertContrast(
            'textPrimary / surface',
            palette.textPrimary,
            palette.surface,
            4.5,
          )
        })

        it('textSecondary vs surface meets AA large text (3:1)', () => {
          assertContrast(
            'textSecondary / surface',
            palette.textSecondary,
            palette.surface,
            3.0,
          )
        })

        it('textOnPrimary vs primary meets AA for UI components (3:1)', () => {
          assertContrast(
            'textOnPrimary / primary',
            palette.textOnPrimary,
            palette.primary,
            3.0,
          )
        })

        it('textPrimary vs surfaceElevated meets AA (4.5:1)', () => {
          assertContrast(
            'textPrimary / surfaceElevated',
            palette.textPrimary,
            palette.surfaceElevated,
            4.5,
          )
        })

        it('tooltipText vs tooltipBg blended over bodyBg meets AA (4.5:1)', () => {
          const blended = blendRgbaOverHex(palette.tooltipBg, palette.bodyBg)
          expect(blended, 'blendRgbaOverHex tooltip').toBeTruthy()
          assertContrast(
            'tooltipText / tooltipBg over bodyBg',
            palette.tooltipText,
            blended!,
            4.5,
          )
        })
      })
    }
  }
})

describe('Skin opacity tokens & readability surface', () => {
  for (const skin of DEFAULT_THEMES) {
    const modes: Array<{ name: string; palette: ColorPalette | undefined }> = [
      { name: 'dark', palette: skin.colors.dark },
      { name: 'light', palette: skin.colors.light },
    ]

    for (const { name, palette } of modes) {
      if (!palette) continue

      describe(`${skin.name} / ${name}`, () => {
        it('has glassContainerBg defined', () => {
          expect(palette.glassContainerBg).toBeTruthy()
          expect(palette.glassContainerBg).toContain('rgba')
        })

        it('opacity tokens are within valid bounds (0..1)', () => {
          for (const [name, val] of [
            ['watermark', palette.opacityWatermark],
            ['subtle', palette.opacitySubtle],
            ['muted', palette.opacityMuted],
          ] as const) {
            if (name === 'subtle' && palette.luminanceClass === 'bright') {
              expect(val, `${name} >= 0`).toBeGreaterThanOrEqual(0)
            } else {
              expect(val, `${name} > 0`).toBeGreaterThan(0)
            }
            expect(val, `${name} < 1`).toBeLessThan(1)
          }
        })

        it('muted opacity is the highest token (disabled states most visible)', () => {
          expect(palette.opacityMuted).toBeGreaterThan(palette.opacityWatermark)
          expect(palette.opacityMuted).toBeGreaterThan(palette.opacitySubtle)
        })

        it('luminanceClass matches expected glass tier', () => {
          expect(['dark', 'medium', 'bright']).toContain(palette.luminanceClass)
        })
      })
    }
  }
})

/**
 * Tier 2 reference stack: alpha-blended glass tint over `bodyBg` (solid canvas fallback).
 * Does not model `--bg-overlay` gradients, photographs, or backdrop-filter — see MASTER.md
 * "Contrast validation reference stacks".
 */
describe('Glass tint over body (approximate leaf readability)', () => {
  for (const skin of DEFAULT_THEMES) {
    const modes: Array<{ name: string; palette: ColorPalette | undefined }> = [
      { name: 'dark', palette: skin.colors.dark },
      { name: 'light', palette: skin.colors.light },
    ]

    for (const { name, palette } of modes) {
      if (!palette) continue

      describe(`${skin.name} / ${name}`, () => {
        it('textPrimary vs blended glassBg on bodyBg meets minimum ratio (3:1)', () => {
          const blended = blendRgbaOverHex(palette.glassBg, palette.bodyBg)
          expect(blended, 'blendRgbaOverHex').toBeTruthy()
          assertContrast(
            'textPrimary / glassBg over bodyBg',
            palette.textPrimary,
            blended!,
            3.0,
          )
        })

        it('textPrimary vs blended glassBgElevated on bodyBg meets minimum ratio (3:1)', () => {
          const blended = blendRgbaOverHex(
            palette.glassBgElevated,
            palette.bodyBg,
          )
          expect(blended, 'blendRgbaOverHex elevated').toBeTruthy()
          assertContrast(
            'textPrimary / glassBgElevated over bodyBg',
            palette.textPrimary,
            blended!,
            3.0,
          )
        })

        it('textSecondary vs blended glassBg on bodyBg meets minimum ratio (3:1)', () => {
          const blended = blendRgbaOverHex(palette.glassBg, palette.bodyBg)
          expect(blended, 'blendRgbaOverHex').toBeTruthy()
          assertContrast(
            'textSecondary / glassBg over bodyBg',
            palette.textSecondary,
            blended!,
            3.0,
          )
        })
      })
    }
  }
})
