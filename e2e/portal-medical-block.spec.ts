import { test, expect } from '@playwright/test'
import { createBookingAndGetPortalToken, completeContactStep } from './helpers/portal'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

test.describe('portal: medical hard block', () => {
  test('answering Yes to a medical question shows physician clearance screen', async ({
    page,
  }) => {
    const token = await createBookingAndGetPortalToken(page)

    // Navigate to portal
    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    // Complete contact step
    await completeContactStep(page)

    // Medical step should be visible
    await expect(page.getByText(/Medical/i).first()).toBeVisible({ timeout: 10_000 })

    // Answer question 1 as "Yes", all others as "No"
    const yesRadios = page.locator('input[type="radio"][value="yes"]')
    const noRadios = page.locator('input[type="radio"][value="no"]')
    await expect(noRadios).toHaveCount(10, { timeout: 5_000 })

    // Click "Yes" on first question
    await yesRadios.nth(0).click()

    // Click "No" on remaining 9
    for (let i = 1; i < 10; i++) {
      await noRadios.nth(i).click()
    }

    // Submit medical answers
    await page.getByRole('button', { name: 'Continue' }).click()

    // Hard block screen should appear
    await expect(
      page.getByText('Physician Clearance Required'),
    ).toBeVisible({ timeout: 10_000 })

    // AlertTriangle icon should be present (rendered as SVG)
    await expect(page.locator('svg.lucide-triangle-alert, svg.lucide-alert-triangle')).toBeVisible()

    // Explanatory text
    await expect(
      page.getByText(/medical condition requires physician clearance/i),
    ).toBeVisible()

    // Continue button exists (allows user to proceed despite block)
    await expect(
      page.getByRole('button', { name: 'Continue' }),
    ).toBeVisible()
  })

  test('answering Yes to multiple questions still shows single block screen', async ({
    page,
  }) => {
    const token = await createBookingAndGetPortalToken(page)

    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    await completeContactStep(page)
    await expect(page.getByText(/Medical/i).first()).toBeVisible({ timeout: 10_000 })

    // Answer "Yes" to first 3 questions, "No" to remaining 7
    const yesRadios = page.locator('input[type="radio"][value="yes"]')
    const noRadios = page.locator('input[type="radio"][value="no"]')
    await expect(noRadios).toHaveCount(10, { timeout: 5_000 })

    for (let i = 0; i < 3; i++) {
      await yesRadios.nth(i).click()
    }
    for (let i = 3; i < 10; i++) {
      await noRadios.nth(i).click()
    }

    await page.getByRole('button', { name: 'Continue' }).click()

    // Same block screen appears
    await expect(
      page.getByText('Physician Clearance Required'),
    ).toBeVisible({ timeout: 10_000 })
  })
})
