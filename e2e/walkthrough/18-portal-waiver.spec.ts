import { test, expect } from '@playwright/test'
import { createBookingAndGetPortalToken, completeContactStep } from '../helpers/portal'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Answer all 10 medical questions "No" and submit. */
async function completeMedicalStep(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.getByText(/Medical/i).first()).toBeVisible({ timeout: 10_000 })

  const noRadios = page.locator('input[type="radio"][value="no"]')
  await expect(noRadios).toHaveCount(10, { timeout: 5_000 })
  for (let i = 0; i < 10; i++) {
    await noRadios.nth(i).click()
  }

  await page.getByRole('button', { name: 'Continue' }).click()
}

/** Draw a squiggle on the signature canvas to simulate a real signature. */
async function drawSignature(page: import('@playwright/test').Page): Promise<void> {
  const canvas = page.locator('canvas').first()
  await expect(canvas).toBeVisible({ timeout: 5_000 })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas has no bounding box')

  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  await page.mouse.move(cx - 40, cy)
  await page.mouse.down()
  await page.mouse.move(cx - 10, cy - 15)
  await page.mouse.move(cx + 10, cy + 15)
  await page.mouse.move(cx + 40, cy)
  await page.mouse.up()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('walkthrough: portal waiver', () => {
  test('waiver step renders signature canvas', async ({ page }) => {
    const token = await createBookingAndGetPortalToken(page)

    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    await completeContactStep(page)
    await completeMedicalStep(page)

    // Waiver step should be visible
    await expect(page.getByText(/Waiver/i).first()).toBeVisible({ timeout: 10_000 })

    // Signature canvas is present
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible({ timeout: 5_000 })
  })

  test('signature canvas accepts input', async ({ page }) => {
    const token = await createBookingAndGetPortalToken(page)

    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    await completeContactStep(page)
    await completeMedicalStep(page)

    await expect(page.getByText(/Waiver/i).first()).toBeVisible({ timeout: 10_000 })

    // Draw on canvas — should not throw
    await drawSignature(page)

    // Canvas is still visible after drawing
    await expect(page.locator('canvas').first()).toBeVisible()
  })

  test('submit waiver advances to Equipment step', async ({ page }) => {
    const token = await createBookingAndGetPortalToken(page)

    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    await completeContactStep(page)
    await completeMedicalStep(page)

    await expect(page.getByText(/Waiver/i).first()).toBeVisible({ timeout: 10_000 })

    // Sign the waiver
    await drawSignature(page)

    // Acknowledge terms checkbox
    const checkbox = page.locator('input[type="checkbox"]').first()
    if (await checkbox.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await checkbox.check()
    }

    // Insurance radio — choose "no"
    const noInsurance = page.locator('input[type="radio"][name="hasInsurance"][value="no"]')
    if (await noInsurance.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await noInsurance.click()
    }

    // Submit waiver
    await page.getByRole('button', { name: 'Continue' }).click()

    // Equipment step should now be visible
    await expect(page.getByText(/Equipment/i).first()).toBeVisible({ timeout: 10_000 })
  })
})
