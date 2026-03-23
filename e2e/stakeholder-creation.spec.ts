import { test, expect } from '@playwright/test'
import { signUpFresh } from './helpers/auth'
import { CREATION_ROLES } from './helpers/creation-test-data'

test.describe('stakeholder creation', () => {
  // Cleanup function set by each test, called in afterEach
  let cleanupFn: (() => Promise<void>) | null = null

  test.afterEach(async () => {
    if (cleanupFn) {
      await cleanupFn()
      cleanupFn = null
    }
  })

  for (const role of CREATION_ROLES) {
    test(`${role.tileLabel} creation flow`, async ({ page }) => {
      // ── Step 1: Create fresh user and sign in ──────────────────────
      const { cleanup } = await signUpFresh(page)
      cleanupFn = cleanup

      // ── Step 2: Navigate to /account — setup wizard should appear ──
      const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
      await page.goto(`${baseUrl}/account`)

      // ── Step 3: Language selection ───────────────────────────────────
      await expect(page.getByText('App language')).toBeVisible({
        timeout: 15_000,
      })
      await page.getByRole('button', { name: 'English' }).first().click()
      await page.getByRole('button', { name: 'Next', exact: true }).click()

      // ── Step 4: Role selection ─────────────────────────────────────
      await expect(page.getByText("What's your role?")).toBeVisible({
        timeout: 15_000,
      })

      // Select the role tile
      await page.getByRole('button', { name: role.tileLabel, exact: true }).click()
      await expect(
        page.getByRole('button', { name: role.tileLabel, exact: true }),
      ).toHaveAttribute('aria-pressed', 'true')

      // Click Next
      await page.getByRole('button', { name: 'Next', exact: true }).click()

      // ── Step 4: Profile form ───────────────────────────────────────
      await expect(page.getByText('Set up your profile')).toBeVisible({
        timeout: 10_000,
      })

      // Verify business name field visibility
      if (role.showsBusinessName) {
        await expect(page.getByLabel('Business name')).toBeVisible()
      } else {
        await expect(page.getByLabel('Business name')).not.toBeVisible()
      }

      // Fill profile form
      await page.getByLabel('First name').fill(role.profile.firstName)
      await page.getByLabel('Last name').fill(role.profile.lastName)
      if (role.showsBusinessName) {
        await page.getByLabel('Business name').fill(role.profile.businessName)
      }
      // Location and contact fields are collected in the dashboard profile form,
      // not the sign-up wizard. LocationPicker requires live Google Places API.

      // Click Next to submit profile
      await page.getByRole('button', { name: 'Next', exact: true }).click()

      // ── Step 5: Redirect → dashboard → OnboardingGuard → /onboarding
      await expect(page).toHaveURL(/\/onboarding/, { timeout: 30_000 })

      // ── Step 6: Onboarding wizard — Step 1 (Profile) ──────────────
      await expect(page.getByText('Welcome to DiveDispatch')).toBeVisible({
        timeout: 10_000,
      })

      // Step indicator should show Profile as step 1
      await expect(page.getByText('Profile')).toBeVisible()

      // Click Next to advance to Step 2 (Preferences)
      await page.getByRole('button', { name: 'Next', exact: true }).click()

      // ── Step 7: Onboarding wizard — Step 2 (Preferences) ──────────
      await expect(page.getByText('Preferences')).toBeVisible({
        timeout: 10_000,
      })

      // Click Next to advance to Step 3 (Review)
      await page.getByRole('button', { name: 'Next', exact: true }).click()

      // ── Step 8: Onboarding wizard — Step 3 (Review) ───────────────
      await expect(page.getByText('Ready to go!')).toBeVisible({
        timeout: 10_000,
      })
      // Verify the role is displayed correctly
      await expect(page.getByText(role.clerkRole, { exact: true })).toBeVisible()

      // ── Step 9: Go to dashboard ────────────────────────────────────
      await page.getByRole('button', { name: 'Go to dashboard' }).click()

      // ── Step 10: Verify landed on role-scoped dashboard ────────────
      await expect(page).toHaveURL(
        new RegExp(`/${role.roleKey}/[^/]+/dashboard`),
        { timeout: 30_000 },
      )
      await expect(
        page.getByRole('heading', { name: /Dashboard/i }),
      ).toBeVisible({ timeout: 10_000 })
    })
  }
})
