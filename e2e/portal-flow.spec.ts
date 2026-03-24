import { test, expect } from '@playwright/test'
import {
  createBookingAndGetPortalToken,
  completeContactStep,
  completeMedicalStep,
  completeWaiverStep,
  completeEquipmentStep,
} from './helpers/portal'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('portal-flow', () => {
  test('customer completes all portal steps and submits', async ({ page }) => {
    const token = await createBookingAndGetPortalToken(page)

    // Navigate to portal as customer
    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    // Welcome heading and activity badge visible (salvaged from walkthrough/16)
    await expect(page.getByRole('heading', { name: /Welcome/i })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('DSD')).toBeVisible({ timeout: 5_000 })

    // Contact form pre-fills first name from booking link (salvaged from walkthrough/16)
    const firstNameValue = await page.getByLabel('Legal First Name *').inputValue()
    expect(firstNameValue).toBeTruthy()

    // -- Step: Contact
    await completeContactStep(page)

    // -- Step: Medical
    // 10 questions rendered, none pre-checked (salvaged from walkthrough/17)
    const noRadios = page.locator('input[type="radio"][value="no"]')
    await expect(noRadios).toHaveCount(10, { timeout: 5_000 })
    const yesRadios = page.locator('input[type="radio"][value="yes"]')
    await expect(yesRadios).toHaveCount(10, { timeout: 5_000 })
    for (let i = 0; i < 10; i++) {
      await expect(noRadios.nth(i)).not.toBeChecked()
      await expect(yesRadios.nth(i)).not.toBeChecked()
    }
    await completeMedicalStep(page)

    // -- Step: Waiver
    await completeWaiverStep(page)

    // -- Step: Equipment
    // Sizing fields are present (salvaged from walkthrough/19)
    await expect(page.getByLabel(/Height/i).first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByLabel(/Weight/i).first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByLabel(/Shoe Size/i).first()).toBeVisible({ timeout: 5_000 })
    await completeEquipmentStep(page)

    // -- Step: Submit
    await expect(
      page.getByRole('button', { name: /Submit My Forms/i }),
    ).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /Submit My Forms/i }).click()

    // -- Confirmation
    await expect(
      page.getByText(/Thank you|Submitted|Complete|Success/i).first(),
    ).toBeVisible({ timeout: 20_000 })
  })

  test('re-visiting portal URL shows completed state', async ({ page }) => {
    const token = await createBookingAndGetPortalToken(page)

    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    // Complete the full flow
    await completeContactStep(page)
    await completeMedicalStep(page)
    await completeWaiverStep(page)
    await completeEquipmentStep(page)

    await expect(
      page.getByRole('button', { name: /Submit My Forms/i }),
    ).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /Submit My Forms/i }).click()

    // Re-visit the same URL (salvaged from walkthrough/20)
    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(
      page.getByText(/Already submitted|Completed|Thank you|Forms submitted/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('contact form validation blocks advance when required fields empty', async ({ page }) => {
    const token = await createBookingAndGetPortalToken(page)

    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    // Clear the pre-filled first name and try to advance
    await expect(page.getByLabel('Legal First Name *')).toBeVisible({ timeout: 10_000 })
    await page.getByLabel('Legal First Name *').fill('')

    await page.getByRole('button', { name: 'Continue' }).click()

    // Still on contact step -- form did not advance
    await expect(page.getByLabel('Legal First Name *')).toBeVisible({ timeout: 3_000 })
  })
})
