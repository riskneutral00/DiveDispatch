import { test, expect } from '@playwright/test'
import { createBookingAndGetPortalToken } from '../helpers/portal'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('walkthrough: portal contact', () => {
  test('portal loads with welcome message and booking summary', async ({ page }) => {
    const token = await createBookingAndGetPortalToken(page)

    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    // Welcome heading and activity badge visible
    await expect(page.getByRole('heading', { name: /Welcome/i })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('DSD')).toBeVisible({ timeout: 5_000 })
  })

  test('contact form shows pre-filled data from booking link', async ({ page }) => {
    const token = await createBookingAndGetPortalToken(page)

    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    // Contact step renders first — Legal First Name input is visible
    await expect(page.getByLabel('Legal First Name *')).toBeVisible({ timeout: 10_000 })

    // Pre-filled from the booking link customer name ("Test Diver")
    const firstNameValue = await page.getByLabel('Legal First Name *').inputValue()
    expect(firstNameValue).toBeTruthy()
  })

  test('contact form validates required fields', async ({ page }) => {
    const token = await createBookingAndGetPortalToken(page)

    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    // Wait for contact form to render
    await expect(page.getByLabel('Legal First Name *')).toBeVisible({ timeout: 10_000 })

    // Clear the pre-filled first name and submit immediately
    await page.getByLabel('Legal First Name *').fill('')

    const continueBtn = page.getByRole('button', { name: 'Continue' })
    await expect(continueBtn).toBeVisible({ timeout: 5_000 })
    await continueBtn.click()

    // Still on contact step — form did not advance
    await expect(page.getByLabel('Legal First Name *')).toBeVisible({ timeout: 3_000 })
  })

  test('valid contact form advances to medical step', async ({ page }) => {
    const token = await createBookingAndGetPortalToken(page)

    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    // Wait for contact form
    await expect(page.getByLabel('Legal First Name *')).toBeVisible({ timeout: 10_000 })

    // Fill all required fields
    await page.getByLabel('Legal First Name *').fill('Jane')
    await page.getByLabel('Legal Last Name *').fill('Customer')
    await page.getByLabel('Email *').fill('jane.customer@example.com')
    await page.getByLabel('Phone *').first().fill('+1 555 000 1234')
    await page.getByLabel('Date of Birth *').fill('1990-06-15')

    // GlassSelect fields — scope via label + sibling select
    await page.locator('label:has-text("Gender") ~ select').selectOption('F')
    await page.locator('label:has-text("Nationality") ~ select').selectOption('United States')

    await page.getByLabel('Passport Number *').fill('AB1234567')
    await page.locator('label:has-text("Issuing Country") ~ select').selectOption('United States')
    await page.getByLabel('Expiration Date *').fill('2030-01-01')

    // Emergency contact — "Full Name *" is unique (personal uses Legal First/Last Name)
    // "Phone *" appears twice; emergency Phone * is the second one
    // "Relationship *" is unique
    await page.getByLabel('Full Name *').fill('John Customer')
    await page.getByLabel('Phone *').nth(1).fill('+1 555 000 5678')
    await page.getByLabel('Relationship *').fill('Spouse')

    // Submit the contact step
    await page.getByRole('button', { name: 'Continue' }).click()

    // Medical step is now active
    await expect(page.getByText(/Medical/i).first()).toBeVisible({ timeout: 10_000 })
  })
})
