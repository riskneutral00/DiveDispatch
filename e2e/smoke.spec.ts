import { test, expect } from '@playwright/test'
import { signInAs } from './helpers/auth'
import { NICOLE } from './helpers/seed'

test.describe('smoke', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/')
    // The landing page contains "DiveDispatch" branding
    await expect(page).toHaveTitle(/DiveDispatch/i)
  })

  test('sign-in page is reachable', async ({ page }) => {
    await page.goto('/sign-in')
    // Clerk renders an iframe or its own elements; just ensure we don't 404
    await expect(page).not.toHaveURL(/404/)
    // Should not redirect to dashboard when unauthenticated
    await expect(page).not.toHaveURL(/\/dashboard/)
  })

  test('authenticated user is redirected to dashboard', async ({ page }) => {
    await signInAs(page, NICOLE.email)
    // After sign-in, /dashboard redirects to the role-specific path
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await expect(page.getByText('DiveCenter Dashboard').or(page.getByText('Dashboard'))).toBeVisible({
      timeout: 10_000,
    })
  })

  test('unauthenticated access to dashboard is redirected to sign-in', async ({ page }) => {
    await page.goto('/dive-center/nicole-dive-center/dashboard')
    // Clerk middleware redirects to sign-in
    await expect(page).toHaveURL(/sign-in/, { timeout: 10_000 })
  })
})
