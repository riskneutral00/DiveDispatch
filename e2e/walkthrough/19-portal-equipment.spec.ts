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

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('walkthrough: portal equipment', () => {
  test('equipment form renders sizing fields', async ({ page }) => {
    const token = await createBookingAndGetPortalToken(page)

    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    await completeContactStep(page)
    await completeMedicalStep(page)
    await completeWaiverStep(page)

    // Equipment step should be visible
    await expect(page.getByText(/Equipment/i).first()).toBeVisible({ timeout: 10_000 })

    // Height, weight, shoe size fields are present
    await expect(page.getByLabel(/Height/i).first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByLabel(/Weight/i).first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByLabel(/Shoe Size/i).first()).toBeVisible({ timeout: 5_000 })
  })

  test('equipment form submits and advances', async ({ page }) => {
    const token = await createBookingAndGetPortalToken(page)

    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    await completeContactStep(page)
    await completeMedicalStep(page)
    await completeWaiverStep(page)

    await expect(page.getByText(/Equipment/i).first()).toBeVisible({ timeout: 10_000 })

    // Fill sizing fields
    const heightField = page.getByLabel(/Height/i).first()
    if (await heightField.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await heightField.fill('175')
    }
    const weightField = page.getByLabel(/Weight/i).first()
    if (await weightField.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await weightField.fill('70')
    }

    // Submit equipment step
    await page.getByRole('button', { name: 'Continue' }).click()

    // Should have advanced to submit step
    await expect(
      page.getByRole('button', { name: /Submit My Forms/i }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('safety information step advances to Submit', async ({ page }) => {
    const token = await createBookingAndGetPortalToken(page)

    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    await completeContactStep(page)
    await completeMedicalStep(page)
    await completeWaiverStep(page)

    await expect(page.getByText(/Equipment/i).first()).toBeVisible({ timeout: 10_000 })

    // Submit equipment without filling optional fields
    await page.getByRole('button', { name: 'Continue' }).click()

    // Submit step or final confirmation should be visible
    await expect(
      page.getByText(/Submit|Review|Complete/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })
})
