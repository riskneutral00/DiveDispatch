import { test, expect } from '@playwright/test'
import { signInAs } from './helpers/auth'
import {
  NICOLE,
  RYAN_CLARKE,
  WATER_PRO,
  HUG_OCEAN_BOAT,
  NICOLE_DC_EQUIPMENT,
  COMPRESSOR_CHALONG,
  AMANDA,
} from './helpers/seed'

/**
 * Guard test: no visible content should render below the calendar on any dashboard.
 *
 * Uses a structural DOM assertion — any new widget, heading, or div
 * added after <BookingCalendar /> in the page JSX will cause a failure,
 * regardless of its text content or component name.
 *
 * Dialogs, portals, and hidden elements are excluded.
 */
test.describe('dashboard layout: no below-calendar content', () => {
  const roles = [
    { name: 'DiveCenter (Nicole)', seed: NICOLE },
    { name: 'Instructor (Ryan Clarke)', seed: RYAN_CLARKE },
    { name: 'Pool (Water Pro)', seed: WATER_PRO },
    { name: 'Boat (Hug Ocean)', seed: HUG_OCEAN_BOAT },
    { name: 'Equipment (Nicole DC)', seed: NICOLE_DC_EQUIPMENT },
    { name: 'Compressor (Chalong)', seed: COMPRESSOR_CHALONG },
    { name: 'Agent (Amanda)', seed: AMANDA },
  ]

  for (const { name, seed } of roles) {
    test(`${name}: nothing below calendar`, async ({ page }) => {
      await signInAs(page, seed.email)
      await expect(page).toHaveURL(new RegExp(seed.dashboardPath.replace(/[/]/g, '\\/')))
      await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 10_000 })

      // Wait for calendar cells to render
      const calendarEl = page.locator('[data-testid="booking-calendar"]')
      await expect(calendarEl).toBeVisible({ timeout: 10_000 })
      await expect(page.locator('[data-testid^="cell-"]').first()).toBeVisible({ timeout: 10_000 })

      // Check for visible siblings after the calendar in its parent container
      const belowCount = await page.evaluate(() => {
        const calendar = document.querySelector('[data-testid="booking-calendar"]')
        if (!calendar) return -1

        const parent = calendar.parentElement
        if (!parent) return -1

        const siblings = Array.from(parent.children)
        const calendarIndex = siblings.indexOf(calendar)

        let count = 0
        for (let i = calendarIndex + 1; i < siblings.length; i++) {
          const el = siblings[i]
          const rect = el.getBoundingClientRect()
          const style = window.getComputedStyle(el)

          // Count elements that are visible and have non-zero height
          if (
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0'
          ) {
            count++
          }
        }
        return count
      })

      expect(belowCount, `Found ${belowCount} visible element(s) below the calendar on ${name} dashboard`).toBe(0)
    })
  }
})

test.describe('dashboard calendar: scroll threshold', () => {
  test('day cells have scroll container with 5-booking max-height', async ({ page }) => {
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath.replace(/[/]/g, '\\/')))
    await expect(page.locator('[data-testid="booking-calendar"]')).toBeVisible({ timeout: 10_000 })

    const pillContainers = page.locator('[data-testid^="day-pills-"]')
    const count = await pillContainers.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const el = pillContainers.nth(i)
      await expect(el).toHaveCSS('overflow-y', 'auto')
      await expect(el).toHaveCSS('max-height', '140px')
    }
  })
})
