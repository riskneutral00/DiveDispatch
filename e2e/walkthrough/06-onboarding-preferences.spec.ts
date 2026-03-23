import { test, expect, type Page } from '@playwright/test'
import { signUpFresh } from '../helpers/auth'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

/**
 * Navigate a fresh DiveCenter user from the account setup wizard through to
 * the Preferences step of the onboarding wizard. Leaves the page at /onboarding
 * with the Preferences step visible.
 *
 * Returns the cleanup function for the created Clerk user.
 */
async function setupToPreferences(page: Page): Promise<() => Promise<void>> {
  const { cleanup } = await signUpFresh(page)

  // ── Step 1: Language selection ──────────────────────────────────────
  await page.goto(`${BASE_URL}/account`)
  await expect(page.getByText('App language')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'English' }).first().click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // ── Step 2: Role selection ──────────────────────────────────────────
  await expect(page.getByText("What's your role?")).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Dive Center', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // ── Step 2: Profile form ────────────────────────────────────────────
  await expect(page.getByText('Set up your profile')).toBeVisible({ timeout: 10_000 })

  await page.getByLabel('First name').fill('Prefs')
  await page.getByLabel('Last name').fill('Test')
  await page.getByLabel('Business name').fill('Prefs Test Shop')
  await page.getByLabel('City').fill('Koh Tao')
  await page.getByLabel('Country').fill('Thailand')
  await page.getByLabel('Contact email').fill('prefs@e2etest.com')
  await page.getByLabel('Contact phone').fill('+66891230099')
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // ── Step 3: Onboarding wizard — Profile step ────────────────────────
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 30_000 })
  await expect(page.getByText('Welcome to DiveDispatch')).toBeVisible({ timeout: 10_000 })

  // Advance from Profile step → Preferences step
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Preferences')).toBeVisible({ timeout: 10_000 })

  return cleanup
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe('walkthrough: onboarding preferences', () => {
  let cleanupFn: (() => Promise<void>) | null = null

  test.afterEach(async () => {
    if (cleanupFn) {
      await cleanupFn()
      cleanupFn = null
    }
  })

  test('preference pills are selectable', async ({ page }) => {
    cleanupFn = await setupToPreferences(page)

    // Open the pill creation form
    await page.getByRole('button', { name: 'Add Quick Book pill' }).click()

    // Activity type options should be visible
    await expect(page.getByRole('button', { name: 'Discover Scuba Diving' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open Water' })).toBeVisible()

    // "Add pill" is disabled when no codes are selected
    await expect(page.getByRole('button', { name: 'Add pill' })).toBeDisabled()

    // Select DSD — "Add pill" becomes enabled (selection active)
    await page.getByRole('button', { name: 'Discover Scuba Diving' }).click()
    await expect(page.getByRole('button', { name: 'Add pill' })).toBeEnabled()

    // Deselect DSD — "Add pill" becomes disabled again (toggle works)
    await page.getByRole('button', { name: 'Discover Scuba Diving' }).click()
    await expect(page.getByRole('button', { name: 'Add pill' })).toBeDisabled()
  })

  test('skip works and advances to Review', async ({ page }) => {
    cleanupFn = await setupToPreferences(page)

    // Skip: click Continue without adding any pills
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    // Should advance to Review step
    await expect(page.getByText('Ready to go!')).toBeVisible({ timeout: 10_000 })
  })

  test('Continue with pills selected advances to Review', async ({ page }) => {
    cleanupFn = await setupToPreferences(page)

    // Open pill form, select DSD + OW, save pill
    await page.getByRole('button', { name: 'Add Quick Book pill' }).click()
    await page.getByRole('button', { name: 'Discover Scuba Diving' }).click()
    await page.getByRole('button', { name: 'Open Water' }).click()
    await page.getByRole('button', { name: 'Add pill' }).click()

    // Pill appears in the list (name defaults to joined codes)
    await expect(page.getByText('DSD, OW')).toBeVisible({ timeout: 5_000 })

    // Click wizard Continue → advance to Review step
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByText('Ready to go!')).toBeVisible({ timeout: 10_000 })
  })
})
