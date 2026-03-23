import { test, expect } from '@playwright/test'
import { signInAs } from './helpers/auth'
import {
  NICOLE,
  RYAN_CLARKE,
  HUG_OCEAN,
  SIROLO,
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
    { name: 'Multi-role DC+Boat+Pool+Equip (Hug Ocean)', seed: HUG_OCEAN },
    { name: 'Multi-role DC+Boat+Equip (Sirolo)', seed: SIROLO },
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

test.describe('dashboard calendar: pill sub-labels per role', () => {
  test('Operator (Nicole DC): pills show instructor first name', async ({ page }) => {
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath.replace(/[/]/g, '\\/')))
    await expect(page.locator('[data-testid="booking-calendar"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid^="cell-"]').first()).toBeVisible({ timeout: 10_000 })

    // Find any pill button with a sub-label separator
    const pills = page.locator('[data-testid^="day-pills-"] button')
    const count = await pills.count()
    let found = false
    for (let i = 0; i < count; i++) {
      const text = await pills.nth(i).textContent()
      if (text && text.includes(' \u00b7 ')) {
        found = true
        const subLabel = text.split(' \u00b7 ')[1]
        // Sub-label should be a short first name (no "Dive Center", "Dive Resort", etc.)
        expect(subLabel).toBeTruthy()
        expect(subLabel).not.toContain('Dive Center')
        expect(subLabel).not.toContain('Dive Resort')
        // First names are single words
        expect(subLabel!.split(' ')).toHaveLength(1)
      }
    }
    expect(found, 'Expected at least one pill with a sub-label separator').toBe(true)
  })

  test('Instructor (Ryan Clarke): pills show shortened operator name', async ({ page }) => {
    await signInAs(page, RYAN_CLARKE.email)
    await expect(page).toHaveURL(new RegExp(RYAN_CLARKE.dashboardPath.replace(/[/]/g, '\\/')))
    await expect(page.locator('[data-testid="booking-calendar"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid^="cell-"]').first()).toBeVisible({ timeout: 10_000 })

    // Navigate forward through calendar ranges to find pills (seed bookings may be in future weeks)
    const nextBtn = page.locator('button[aria-label="Next 2 weeks"]')
    let found = false
    for (let attempt = 0; attempt < 6 && !found; attempt++) {
      const pills = page.locator('[data-testid^="day-pills-"] button')
      const count = await pills.count()
      for (let i = 0; i < count; i++) {
        const text = await pills.nth(i).textContent()
        if (text && text.includes(' \u00b7 ')) {
          found = true
          const subLabel = text.split(' \u00b7 ')[1]
          expect(subLabel).toBeTruthy()
          // Should not be "Ryan" (the viewer's own name) — it should be the operator
          expect(subLabel).not.toBe('Ryan')
          break
        }
      }
      if (!found) await nextBtn.click()
    }
    expect(found, 'Expected at least one pill with a sub-label separator within 12 weeks').toBe(true)
  })
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
      await expect(el).toHaveCSS('height', '140px')
    }
  })
})
