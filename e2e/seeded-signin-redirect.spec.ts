import { test, expect } from '@playwright/test'
import { signInAs } from './helpers/auth'

const ADMIN = {
  email: 'admin+clerk_test@divedispatch.dev',
  slug: 'admin',
  roleKey: 'venue',
  dashboardPath: '/admin/venue/dashboard',
} as const

test.describe('Seeded sign-in lands directly on dashboard (no /sign-up bounce)', () => {
  test('seeded admin lands on /admin/venue/dashboard, never /sign-up', async ({ page }) => {
    await signInAs(page, ADMIN.email)
    const expected = new RegExp(ADMIN.dashboardPath.replace(/\//g, '\\/') + '$')
    await expect(page).toHaveURL(expected, { timeout: 30_000 })
    expect(page.url()).not.toContain('/sign-up')
  })
})
