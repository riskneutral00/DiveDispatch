import { test, expect, type Page } from '@playwright/test'
import { signUpFresh } from './helpers/auth'

/**
 * Layout guard: wizard navigation buttons must match the width of the
 * content area above them. Uses getBoundingClientRect() to measure
 * actual rendered widths.
 *
 * Tolerance: 1px for subpixel rounding.
 */

async function assertNavMatchesContent(page: Page, stepLabel: string) {
  const widths = await page.evaluate(() => {
    const content = document.querySelector('[data-testid="wizard-content"]')
    const nav = document.querySelector('[data-testid="wizard-nav"]')
    if (!content || !nav) return null
    return {
      contentWidth: content.getBoundingClientRect().width,
      navWidth: nav.getBoundingClientRect().width,
    }
  })

  expect(widths, `${stepLabel}: wizard-content and wizard-nav must both be present`).not.toBeNull()
  expect(
    Math.abs(widths!.contentWidth - widths!.navWidth),
    `${stepLabel}: nav width (${widths!.navWidth}px) should match content width (${widths!.contentWidth}px)`,
  ).toBeLessThanOrEqual(1)
}

test.describe('wizard layout: button width matches content', () => {
  test('role + profile steps have aligned buttons', async ({ page }) => {
    const { cleanup } = await signUpFresh(page)

    try {
      // signUpFresh lands on Language step (Step 2)
      await page.waitForLoadState('domcontentloaded')
      await page.getByText('App language').waitFor({ timeout: 30_000 })
      await page.getByRole('button', { name: 'English' }).first().click()
      await page.getByRole('button', { name: 'Next', exact: true }).click()

      // ── Role step ──
      await page.getByText("What's your role?").waitFor({ timeout: 10_000 })
      await assertNavMatchesContent(page, 'Role step')

      // Select Dive Center and advance
      await page.getByRole('button', { name: 'Dive Center' }).click()
      await page.getByRole('button', { name: 'Next', exact: true }).click()

      // ── Profile step ──
      await page.getByText('Set up your profile').waitFor({ timeout: 10_000 })
      await assertNavMatchesContent(page, 'Profile step')
    } finally {
      await cleanup()
    }
  })
})
