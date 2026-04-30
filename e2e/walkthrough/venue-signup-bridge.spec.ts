import { test, expect, type Page } from '@playwright/test'
import { setupClerkTestingToken } from '@clerk/testing/playwright'

const PASSWORD = 'DiveDispatch-E2E-Xk9$mQ7!'
const STORAGE_KEY = 'dd-signup-venue-intent'

async function signUpAndPickTiles(page: Page, tiles: string[]): Promise<string> {
  await setupClerkTestingToken({ page })
  const email = `e2e-venue-${Date.now()}+clerk_test@example.com`

  await page.goto('/sign-up')
  await page.getByRole('textbox', { name: 'Email address' }).fill(email)
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Continue' }).click()

  const otp = page.locator('input[autocomplete="one-time-code"]').first()
  await otp.waitFor({ timeout: 15_000 })
  await otp.fill('424242')

  await expect(page.getByText("What's your role?")).toBeVisible({ timeout: 15_000 })
  for (const tile of tiles) {
    await page.getByRole('button', { name: tile, exact: true }).click()
  }
  await page.getByTestId('wizard-nav').getByRole('button', { name: 'Next' }).click()
  return email
}

async function completeProfileStep(page: Page) {
  await page.getByLabel('First name').fill('Venue')
  await page.getByLabel('Last name').fill('Bridge')
  await page.getByLabel('Contact phone').fill('+66891230099')
  const tc = page.getByRole('checkbox').first()
  if (await tc.isVisible().catch(() => false)) {
    await tc.check()
  }
  await page.getByRole('button', { name: /Sign up|Submit|Create/i }).first().click()
}

async function deleteUser(email: string) {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY
  if (!clerkSecretKey) return
  const listRes = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${clerkSecretKey}` } },
  )
  const users = (await listRes.json()) as Array<{ id: string }>
  if (users[0]?.id) {
    await fetch(`https://api.clerk.com/v1/users/${users[0].id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${clerkSecretKey}` },
    })
  }
}

test.describe('walkthrough: venue signup intent bridge', () => {
  let cleanupEmail: string | null = null

  test.afterEach(async () => {
    if (cleanupEmail) {
      await deleteUser(cleanupEmail)
      cleanupEmail = null
    }
  })

  test('Pool-only signup auto-opens Venue onboarding on dashboard', async ({ page }) => {
    cleanupEmail = await signUpAndPickTiles(page, ['Pool'])
    await completeProfileStep(page)

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })
    await expect(page.getByText(/Set up your.*profile/i)).toBeVisible({ timeout: 15_000 })

    const stored = await page.evaluate((key) => window.sessionStorage.getItem(key), STORAGE_KEY)
    expect(stored).toBe('pool')
  })

  test('Dive-Site-only signup auto-opens Venue onboarding on dashboard', async ({ page }) => {
    cleanupEmail = await signUpAndPickTiles(page, ['Dive Site'])
    await completeProfileStep(page)

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })
    await expect(page.getByText(/Set up your.*profile/i)).toBeVisible({ timeout: 15_000 })

    const stored = await page.evaluate((key) => window.sessionStorage.getItem(key), STORAGE_KEY)
    expect(stored).toBe('dive_site')
  })

  test('Refresh before completion preserves intent and reopens onboarding', async ({ page }) => {
    cleanupEmail = await signUpAndPickTiles(page, ['Pool'])
    await completeProfileStep(page)

    await expect(page.getByText(/Set up your.*profile/i)).toBeVisible({ timeout: 15_000 })
    const beforeReload = await page.evaluate((key) => window.sessionStorage.getItem(key), STORAGE_KEY)
    expect(beforeReload).toBe('pool')

    await page.reload()
    await expect(page.getByText(/Set up your.*profile/i)).toBeVisible({ timeout: 15_000 })
    const afterReload = await page.evaluate((key) => window.sessionStorage.getItem(key), STORAGE_KEY)
    expect(afterReload).toBe('pool')
  })

  test('Mixed-role (DiveCenter + Dive Site) lands per precedence and still auto-opens Venue onboarding', async ({ page }) => {
    cleanupEmail = await signUpAndPickTiles(page, ['Dive Center', 'Dive Site'])
    await completeProfileStep(page)

    await expect(page).toHaveURL(/\/dive-center\/dashboard/, { timeout: 30_000 })
    await expect(page.getByText(/Set up your.*profile/i)).toBeVisible({ timeout: 15_000 })

    const stored = await page.evaluate((key) => window.sessionStorage.getItem(key), STORAGE_KEY)
    expect(stored).toBe('dive_site')
  })
})
