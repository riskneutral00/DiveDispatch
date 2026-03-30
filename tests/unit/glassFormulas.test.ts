import { describe, it, expect } from 'vitest'
import { GLASS_FORMULAS, SKINS } from '../../src/themes/skins'
import type { ColorPalette } from '../../src/themes/theme-types'

describe('GLASS_FORMULAS structural invariants', () => {
  const tiers = ['dark', 'medium', 'bright'] as const

  for (const tier of tiers) {
    describe(`${tier} tier`, () => {
      const formula = GLASS_FORMULAS[tier]

      it('has positive blur values', () => {
        expect(formula.glassBlur).toBeGreaterThan(0)
        expect(formula.glassBlurElevated).toBeGreaterThan(0)
        expect(formula.glassBlurHover).toBeGreaterThan(0)
      })

      it('elevated blur is greater than or equal to base blur', () => {
        expect(formula.glassBlurElevated).toBeGreaterThanOrEqual(formula.glassBlur)
      })

      it('all opacity values are in [0, 1]', () => {
        expect(formula.opacityWatermark).toBeGreaterThanOrEqual(0)
        expect(formula.opacityWatermark).toBeLessThanOrEqual(1)
        expect(formula.opacitySubtle).toBeGreaterThanOrEqual(0)
        expect(formula.opacitySubtle).toBeLessThanOrEqual(1)
        expect(formula.opacityMuted).toBeGreaterThanOrEqual(0)
        expect(formula.opacityMuted).toBeLessThanOrEqual(1)
      })

      it('opacity ordering: muted > watermark', () => {
        expect(formula.opacityMuted).toBeGreaterThan(formula.opacityWatermark)
      })

      it('all background colors are rgba strings', () => {
        expect(formula.glassBg).toMatch(/^rgba\(/)
        expect(formula.glassBgElevated).toMatch(/^rgba\(/)
        expect(formula.glassBgHover).toMatch(/^rgba\(/)
        expect(formula.glassContainerBg).toMatch(/^rgba\(/)
      })

      it('all border colors are rgba strings', () => {
        expect(formula.glassBorder).toMatch(/^rgba\(/)
        expect(formula.glassBorderElevated).toMatch(/^rgba\(/)
        expect(formula.glassContainerBorder).toMatch(/^rgba\(/)
      })

      it('all shadow colors are rgba strings', () => {
        expect(formula.glassShadow).toMatch(/^rgba\(/)
        expect(formula.glassShadowElevated).toMatch(/^rgba\(/)
      })

      it('all specular colors are rgba strings', () => {
        expect(formula.glassSpecular).toMatch(/^rgba\(/)
        expect(formula.glassSpecularSubtle).toMatch(/^rgba\(/)
      })
    })
  }
})

describe('SKINS data integrity', () => {
  for (const skin of SKINS) {
    describe(`${skin.name}`, () => {
      it('has a non-empty id and name', () => {
        expect(skin.id).toBeTruthy()
        expect(skin.name).toBeTruthy()
      })

      it('has a dark palette', () => {
        expect(skin.colors.dark).toBeDefined()
      })

      it('dark palette has all required status colors', () => {
        const p = skin.colors.dark
        expect(p.statusActive).toBeTruthy()
        expect(p.statusDraft).toBeTruthy()
        expect(p.statusUpcoming).toBeTruthy()
        expect(p.statusCompleted).toBeTruthy()
        expect(p.statusCancelled).toBeTruthy()
        expect(p.statusUrgent).toBeTruthy()
        expect(p.statusBlocked).toBeTruthy()
        expect(p.statusMultidayBorder).toBeTruthy()
      })

      it('dark palette has primary glow and hover border', () => {
        const p = skin.colors.dark
        expect(p.primaryGlow).toBeTruthy()
        expect(p.glassBorderHover).toBeTruthy()
      })

      it('dark palette has surface and surfaceElevated', () => {
        const p = skin.colors.dark
        expect(p.surface).toBeTruthy()
        expect(p.surfaceElevated).toBeTruthy()
      })

      it('dark palette has bodyBg', () => {
        expect(skin.colors.dark.bodyBg).toBeTruthy()
      })

      it('has valid typography weights', () => {
        expect(skin.typography.headingWeight).toBeGreaterThan(0)
        expect(skin.typography.bodyWeight).toBeGreaterThan(0)
      })

      it('has a non-empty borderRadius', () => {
        expect(skin.shape.borderRadius).toBeTruthy()
        expect(skin.shape.borderRadius).toMatch(/\d+px/)
      })

      if (skin.colors.light) {
        it('light palette has all required status colors', () => {
          const p = skin.colors.light!
          expect(p.statusActive).toBeTruthy()
          expect(p.statusDraft).toBeTruthy()
          expect(p.statusUpcoming).toBeTruthy()
          expect(p.statusCompleted).toBeTruthy()
          expect(p.statusCancelled).toBeTruthy()
          expect(p.statusUrgent).toBeTruthy()
          expect(p.statusBlocked).toBeTruthy()
        })

        it('light palette has different primary than dark', () => {
          expect(skin.colors.light!.primary).not.toBe(skin.colors.dark.primary)
        })
      }
    })
  }
})
