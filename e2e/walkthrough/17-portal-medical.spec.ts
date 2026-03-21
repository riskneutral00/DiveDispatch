import { test, expect } from '@playwright/test'
import { createBookingAndGetPortalToken, completeContactStep } from '../helpers/portal'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('walkthrough: portal medical', () => {
  test('medical questionnaire renders 10 questions unanswered', async ({ page }) => {
    const token = await createBookingAndGetPortalToken(page)

    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    // Complete contact step to advance to medical
    await completeContactStep(page)

    // Medical step should now be visible
    await expect(page.getByText(/Medical/i).first()).toBeVisible({ timeout: 10_000 })

    // 10 "No" radio buttons should be present and none pre-selected
    const noRadios = page.locator('input[type="radio"][value="no"]')
    await expect(noRadios).toHaveCount(10, { timeout: 5_000 })

    // Verify none are pre-selected
    const yesRadios = page.locator('input[type="radio"][value="yes"]')
    await expect(yesRadios).toHaveCount(10, { timeout: 5_000 })

    for (let i = 0; i < 10; i++) {
      await expect(noRadios.nth(i)).not.toBeChecked()
      await expect(yesRadios.nth(i)).not.toBeChecked()
    }
  })

  test('all No answers submits and advances to Waiver', async ({ page }) => {
    const token = await createBookingAndGetPortalToken(page)

    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    // Complete contact step
    await completeContactStep(page)

    // Wait for medical step
    await expect(page.getByText(/Medical/i).first()).toBeVisible({ timeout: 10_000 })

    // Answer all 10 questions "No"
    const noRadios = page.locator('input[type="radio"][value="no"]')
    await expect(noRadios).toHaveCount(10, { timeout: 5_000 })
    for (let i = 0; i < 10; i++) {
      await noRadios.nth(i).click()
    }

    // Submit medical step
    await page.getByRole('button', { name: 'Continue' }).click()

    // Waiver step should now be visible
    await expect(page.getByText(/Waiver/i).first()).toBeVisible({ timeout: 10_000 })
  })
})
