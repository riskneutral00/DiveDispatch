import { test, expect } from '@playwright/test'
import { setupClerkTestingToken } from '@clerk/testing/playwright'

test('sign up as new dive-center via UI and reach dashboard', async ({ page }) => {
  await setupClerkTestingToken({ page })

  const email = `e2e-dc-${Date.now()}+clerk_test@example.com`

  await page.goto('/sign-up')
  await page.getByRole('textbox', { name: 'Email address' }).fill(email)
  await page.getByRole('textbox', { name: 'Password' }).fill('DiveDispatch-E2E-Xk9$mQ7!')
  await page.getByRole('button', { name: 'Continue' }).click()

  const otpInput = page.locator('input[autocomplete="one-time-code"]').first()
  await otpInput.waitFor({ timeout: 15_000 })
  await otpInput.fill('424242')

  await expect(page.getByText("What's your role?")).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Dive Center' }).click()
  await page.getByTestId('wizard-nav').getByRole('button', { name: 'Next' }).click()

  await expect(page).toHaveURL(/\/dive-center\/dashboard/, { timeout: 30_000 })

  const clerkSecretKey = process.env.CLERK_SECRET_KEY!
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
})
