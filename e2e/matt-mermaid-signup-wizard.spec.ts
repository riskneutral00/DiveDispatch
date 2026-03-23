/**
 * E2E: matt-mermaid sign-up wizard walkthrough
 *
 * Uses a pre-issued Clerk sign-in token for matt-mermaid+clerk_test@divedispatch.dev.
 * The account has a Clerk identity but no Convex user record.
 *
 * Covers:
 *   Step 1  — /sign-in  (token applied, redirect to /sign-up?resume=1)
 *   Step 2  — /sign-up  resume prompt ("Sign up in progress")
 *   Step 3  — /sign-up  "About You" form
 *   Step 4  — /sign-up  "Role" selection
 *   Step 5  — /onboarding "Business Info"
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

// Pre-issued Clerk sign-in token for matt-mermaid+clerk_test@divedispatch.dev
const CLERK_TOKEN =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJlaXMiOjMwMCwiZXhwIjoxNzc0MjEwMTg3LCJpaWQiOiJpbnNfMzljcm1IdExYdmtQRTJ3OHlPa3lva25EeWxSIiwic2lkIjoic2l0XzNCSmF6SW12aVRaV3pBMnJtZGJ0RkdBdXFieSIsInN0Ijoic2lnbl9pbl90b2tlbiJ9.baaoZC79JH-6nGYEiZikFhENob8ijSXaq2PdvBF7yImoJrJ_XHcJdjE7oS45SlXPb9JV4LRScjq40PHF-ZLw9EcAk2KIliCvZSRns2oDRVFPjLaGR0eCyTH3U_utPIdecD6aiuLE9Sl51SkdjjvZseKQAXioa2Ts2FV9iFe95tivv8JgO04EetaJJXldlZblKXdJ_ElNpcM1H0gXKTPk9sn86VMCsk6Lf1UfS7eqkdwFVc83u7p9Nyo8i8tcnZlQ3eoOiqf1U49_SWDUvijfSGgg5p3U8efaZnAHJ9i-I0IwHNE8LWEKynE-1fq-V7m12F410NQfrowYQgt0gaC4lg'

const screenshotsDir = path.join(__dirname, '..', 'screenshots', 'matt-mermaid-signup')

test.describe('matt-mermaid sign-up wizard', () => {
  test('completes wizard steps 1-5 and lands on Business Info', async ({ page }) => {
    // ── Step 1: Navigate to sign-in and apply token ─────────────────────────
    await page.goto(`${BASE_URL}/sign-in`)

    // Wait for Clerk SDK to initialise
    await page.waitForFunction(() => typeof (window as any).Clerk !== 'undefined', {
      timeout: 15_000,
    })

    // Brief extra wait for Clerk to fully mount its state
    await page.waitForTimeout(1_500)

    // Apply the sign-in token via Clerk's JS API
    await page.evaluate(async (token: string) => {
      const clerk = (window as any).Clerk
      const result = await clerk.client.signIn.create({
        strategy: 'ticket',
        ticket: token,
      })
      await clerk.setActive({ session: result.createdSessionId })
    }, CLERK_TOKEN)

    // Wait for redirect away from sign-in — either /sign-up or /dashboard
    await page.waitForURL(
      (url) => !url.pathname.startsWith('/sign-in'),
      { timeout: 20_000 },
    )

    await page.screenshot({
      path: path.join(screenshotsDir, '01-after-token-signin.png'),
      fullPage: true,
    })
    console.log('Step 1 complete — redirected to:', page.url())

    // ── Step 2: Resume prompt ───────────────────────────────────────────────
    // If we land on /sign-up without ?resume=1 the page shows "Sign up in progress"
    // If redirected to /sign-up?resume=1 the resume prompt is skipped automatically.
    // In either case we need to reach the "About You" step.
    const currentUrl = page.url()

    if (currentUrl.includes('/sign-up')) {
      // Check whether resume prompt is visible
      const resumeHeading = page.getByText('Sign up in progress')
      const isResumeVisible = await resumeHeading
        .isVisible()
        .catch(() => false)

      if (isResumeVisible) {
        await expect(resumeHeading).toBeVisible({ timeout: 8_000 })
        await expect(page.getByRole('button', { name: 'Start over' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()

        await page.screenshot({
          path: path.join(screenshotsDir, '02-resume-prompt.png'),
          fullPage: true,
        })
        console.log('Step 2 — resume prompt visible, clicking Continue')

        await page.getByRole('button', { name: 'Continue' }).click()
      } else {
        console.log('Step 2 — resume prompt not shown (resume=1 param), proceeding')
        await page.screenshot({
          path: path.join(screenshotsDir, '02-no-resume-prompt.png'),
          fullPage: true,
        })
      }

      // ── Step 3: About You ─────────────────────────────────────────────────
      await expect(page.getByText('About You')).toBeVisible({ timeout: 15_000 })

      await page.screenshot({
        path: path.join(screenshotsDir, '03-about-you-empty.png'),
        fullPage: true,
      })
      console.log('Step 3 — About You visible')

      // Select app language — English should be the first flag button
      // LanguagePicker renders toggle buttons; find English
      const englishBtn = page
        .getByRole('button', { name: /english/i })
        .first()
      const englishBtnVisible = await englishBtn.isVisible().catch(() => false)

      if (englishBtnVisible) {
        await englishBtn.click()
        console.log('Step 3 — English language selected')
      } else {
        // Language picker may already default to English or uses a different pattern
        console.log('Step 3 — English button not directly visible, checking picker state')
      }

      // Fill First name
      await page.getByLabel('First name').fill('Matt')
      // Fill Last name
      await page.getByLabel('Last name').fill('Mermaid')

      await page.screenshot({
        path: path.join(screenshotsDir, '03-about-you-filled.png'),
        fullPage: true,
      })
      console.log('Step 3 — About You filled: Matt Mermaid')

      // Click Next — only enabled when language + first + last are filled
      const nextBtn = page.getByRole('button', { name: 'Next', exact: true })
      await expect(nextBtn).toBeEnabled({ timeout: 5_000 })
      await nextBtn.click()

      // ── Step 4: Role selection ───────────────────────────────────────────
      await expect(page.getByText("What's your role?")).toBeVisible({ timeout: 15_000 })

      await page.screenshot({
        path: path.join(screenshotsDir, '04-role-empty.png'),
        fullPage: true,
      })
      console.log('Step 4 — Role selection visible')

      // Select Dive Center
      await page.getByRole('button', { name: 'Dive Center', exact: true }).click()

      await page.screenshot({
        path: path.join(screenshotsDir, '04-role-selected.png'),
        fullPage: true,
      })
      console.log('Step 4 — Dive Center selected')

      // Click Next / Continue to trigger createUser and redirect to /onboarding
      const roleNextBtn = page.getByRole('button', { name: 'Next', exact: true })
      await expect(roleNextBtn).toBeEnabled({ timeout: 5_000 })
      await roleNextBtn.click()

      // Wait for /onboarding redirect (createUser fires then partial-user effect redirects)
      await page.waitForURL('**/onboarding**', { timeout: 30_000 })
    } else {
      // Redirected directly somewhere else (unlikely for this account state)
      console.log('Unexpected redirect to:', currentUrl)
    }

    // ── Step 5: Business Info (on /onboarding) ─────────────────────────────
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10_000 })
    await expect(page.getByText('Welcome to DiveDispatch')).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('Business Info')).toBeVisible({ timeout: 10_000 })

    await page.screenshot({
      path: path.join(screenshotsDir, '05-business-info-empty.png'),
      fullPage: true,
    })
    console.log('Step 5 — Business Info visible on /onboarding')

    // Fill in business name
    const bizInput = page.getByLabel('Business name')
    await expect(bizInput).toBeVisible({ timeout: 5_000 })
    await bizInput.fill("Matt's Dive Center")

    await page.screenshot({
      path: path.join(screenshotsDir, '05-business-info-filled.png'),
      fullPage: true,
    })
    console.log("Step 5 — Business name filled: Matt's Dive Center")

    // Verify the Next button is now enabled
    const bizNextBtn = page.getByRole('button', { name: 'Next', exact: true })
    await expect(bizNextBtn).toBeEnabled({ timeout: 5_000 })

    console.log('All wizard steps verified successfully')
  })
})
