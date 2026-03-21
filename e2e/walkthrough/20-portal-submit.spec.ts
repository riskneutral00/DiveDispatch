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

/** Complete the waiver step (sign + submit). */
async function completeWaiverStep(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.getByText(/Waiver/i).first()).toBeVisible({ timeout: 10_000 })

  await drawSignature(page)

  const checkbox = page.locator('input[type="checkbox"]').first()
  if (await checkbox.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await checkbox.check()
  }

  const noInsurance = page.locator('input[type="radio"][name="hasInsurance"][value="no"]')
  if (await noInsurance.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await noInsurance.click()
  }

  await page.getByRole('button', { name: 'Continue' }).click()
}

/** Complete the equipment step (skip optional fields). */
async function completeEquipmentStep(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.getByText(/Equipment/i).first()).toBeVisible({ timeout: 10_000 })

  await page.getByRole('button', { name: 'Continue' }).click()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('walkthrough: portal submit', () => {
  test('Submit My Forms shows success screen', async ({ page }) => {
    const token = await createBookingAndGetPortalToken(page)

    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    await completeContactStep(page)
    await completeMedicalStep(page)
    await completeWaiverStep(page)
    await completeEquipmentStep(page)

    // Should reach submit step
    await expect(
      page.getByRole('button', { name: /Submit My Forms/i }),
    ).toBeVisible({ timeout: 10_000 })

    // Click submit
    await page.getByRole('button', { name: /Submit My Forms/i }).click()

    // Success screen visible
    await expect(
      page.getByText(/Thank you|Submitted|Complete|Success/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('re-visiting portal URL shows Completed state', async ({ page }) => {
    const token = await createBookingAndGetPortalToken(page)

    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    await completeContactStep(page)
    await completeMedicalStep(page)
    await completeWaiverStep(page)
    await completeEquipmentStep(page)

    await expect(
      page.getByRole('button', { name: /Submit My Forms/i }),
    ).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /Submit My Forms/i }).click()

    // Re-visit the same URL
    await page.goto(`${BASE_URL}/portal/${token}`)

    // Should show a completed/already-submitted state, not the form
    await expect(
      page.getByText(/Already submitted|Completed|Thank you|Forms submitted/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })
})
