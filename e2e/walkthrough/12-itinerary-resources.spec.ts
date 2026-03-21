import { test, expect } from '@playwright/test'
import { signInAsDiveCenter } from '../helpers/auth'
import { futureDateString } from '../helpers/seed'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Open the wizard, fill customers, fill itinerary activity + date (DSD). */
async function advanceToItineraryWithDSD(
  page: import('@playwright/test').Page,
  startDate: string,
): Promise<void> {
  await page.getByRole('button', { name: /Booking/i }).click()
  await expect(page.getByLabel('Full name *')).toBeVisible({ timeout: 10_000 })

  await page.getByLabel('Full name *').fill('Test Diver')
  await page.locator('input[type="email"]').first().fill('testdiver@example.com')
  await page.getByRole('button', { name: 'English' }).click()

  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Select DSD and set start date
  await page.locator('select').first().selectOption('DSD')
  await page.locator('input[type="date"]').first().fill(startDate)

  // Wait for day config to render
  await expect(page.getByText(/Day 1/)).toBeVisible({ timeout: 5_000 })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('walkthrough: itinerary resources step', () => {
  test('resource fields accept instructor input', async ({ page }) => {
    const startDate = futureDateString(62)

    await signInAsDiveCenter(page)
    await advanceToItineraryWithDSD(page, startDate)

    // Instructor dropdown is visible
    const instructorSelect = page.locator('select').filter({ hasText: /Select instructor/ })
    await expect(instructorSelect).toBeVisible({ timeout: 10_000 })

    // Ryan Clarke is available in the dropdown
    const ryanOption = instructorSelect.locator('option:has-text("Ryan Clarke")')
    await expect(ryanOption).toBeAttached({ timeout: 10_000 })

    // Select Ryan Clarke
    const ryanValue = await ryanOption.getAttribute('value')
    if (ryanValue) {
      await instructorSelect.selectOption(ryanValue)
    }

    // Instructor is selected — option shows Ryan Clarke
    await expect(instructorSelect).toContainText('Ryan Clarke')
  })

  test('Next triggers draft creation and advances to Review step', async ({ page }) => {
    const startDate = futureDateString(63)

    await signInAsDiveCenter(page)
    await advanceToItineraryWithDSD(page, startDate)

    // Select first available instructor
    const instructorSelect = page.locator('select').filter({ hasText: /Select instructor/ })
    await expect(instructorSelect).toBeVisible({ timeout: 10_000 })

    const allOptions = instructorSelect.locator('option')
    const count = await allOptions.count()
    for (let i = 0; i < count; i++) {
      const val = await allOptions.nth(i).getAttribute('value')
      if (val && val !== '' && val !== '__external__') {
        await instructorSelect.selectOption(val)
        break
      }
    }

    // Click Next — createDraftShell fires, wizard advances to Review
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    // Review step is visible — "Submit Booking" button appears
    await expect(page.getByRole('button', { name: 'Submit Booking' })).toBeVisible({ timeout: 10_000 })
  })
})
