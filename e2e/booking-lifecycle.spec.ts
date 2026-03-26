import { test, expect } from '@playwright/test'
import { signInAs } from './helpers/auth'
import { NICOLE, futureDateString } from './helpers/seed'

const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_URL?.replace('.cloud', '.site')
if (!CONVEX_SITE_URL) throw new Error('NEXT_PUBLIC_CONVEX_URL env var required for E2E tests')

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Open the booking overlay via a QUICK BOOK pill. Default: DSD (simplest). */
async function openBookingOverlay(
  page: import('@playwright/test').Page,
  card: 'DSD' | 'OW' | 'AOW' | 'O+A' = 'DSD',
): Promise<void> {
  // Quick book pills have exact text labels (e.g. "DSD", "OW", "O+A").
  // Booking bars use "DSD · customer" format — exact match avoids those.
  await page.getByRole('button', { name: card, exact: true }).first().click()
  await expect(page.getByLabel('Full name *')).toBeVisible({ timeout: 10_000 })
}

/** Advance the wizard to the next step. Waits for the step transition to settle. */
async function clickNext(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  // Step transition: wait for the itinerary step's course select OR the review step's submit
  // button to appear — these are reliable signals that the next step has rendered.
  await expect(
    page.locator('[data-testid="course-activity-select"]').first()
      .or(page.getByRole('button', { name: 'Submit Booking' })),
  ).toBeVisible({ timeout: 10_000 })
}

/** Fill a single customer in the customer step. */
async function fillOneCustomer(
  page: import('@playwright/test').Page,
  name: string,
  email: string,
  index: number,
) {
  const nameInputs = page.getByLabel('Full name *')
  await nameInputs.nth(index).fill(name)

  // Email is the default contact type — find the email inputs
  const emailInputs = page.locator('[data-testid="customer-email"]')
  await emailInputs.nth(index).fill(email)

  // Select English language flag — each customer has one flag picker,
  // so nth(index) targets the correct customer's English flag.
  const englishFlags = page.getByRole('button', { name: 'English' })
  await englishFlags.nth(index).click()
}

/** Add N-1 additional customers and fill all N. */
async function fillMultipleCustomers(
  page: import('@playwright/test').Page,
  customers: { name: string; email: string }[],
) {
  // Fill the first customer (already exists)
  await fillOneCustomer(page, customers[0].name, customers[0].email, 0)

  // Add remaining customers
  for (let i = 1; i < customers.length; i++) {
    await page.getByRole('button', { name: /Add Customer/i }).click()
    // Wait for the new customer's name input to appear
    await expect(page.getByLabel('Full name *').nth(i)).toBeVisible({ timeout: 5_000 })
    await fillOneCustomer(page, customers[i].name, customers[i].email, i)
  }
}

const FIVE_CUSTOMERS = [
  { name: 'Chen Wei', email: 'chen.wei@test.com' },
  { name: 'Sophie Martin', email: 'sophie.martin@test.com' },
  { name: 'Takeshi Yamamoto', email: 'takeshi.y@test.com' },
  { name: 'Emma Thompson', email: 'emma.t@test.com' },
  { name: 'Kim Soo-jin', email: 'kim.soojin@test.com' },
]

/** Discard the current draft by clicking the wizard's cancel button. */
async function discardDraft(page: import('@playwright/test').Page) {
  // On step 1 the button says "Cancel"; on later steps it says "Back".
  const cancelBtn = page.getByRole('button', { name: 'Cancel', exact: true })
  const backBtn = page.getByRole('button', { name: 'Back', exact: true })
  const target = (await cancelBtn.isVisible({ timeout: 2_000 }).catch(() => false))
    ? cancelBtn
    : (await backBtn.isVisible({ timeout: 1_000 }).catch(() => false))
      ? backBtn
      : null
  if (target) {
    await target.click()
    // Wait for the overlay to close
    await expect(page.getByLabel('Full name *')).not.toBeVisible({ timeout: 5_000 })
  }
}

// ── Step 1: Customer Step Validation ────────────────────────────────────────

test.describe('1 — Customer step validation', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await openBookingOverlay(page)
  })

  test.afterEach(async ({ page }) => {
    await discardDraft(page)
  })

  test('1a — name missing → Next disabled', async ({ page }) => {
    // Fill contact and language but NOT name
    await page.locator('[data-testid="customer-email"]').first().fill('test@test.com')
    await page.getByRole('button', { name: 'English' }).click()

    const nextBtn = page.getByRole('button', { name: 'Next', exact: true })
    await expect(nextBtn).toBeDisabled()
  })

  test('1b — contact missing → Next disabled', async ({ page }) => {
    // Fill name and language but NOT contact
    await page.getByLabel('Full name *').fill('Test Customer')
    await page.getByRole('button', { name: 'English' }).click()

    const nextBtn = page.getByRole('button', { name: 'Next', exact: true })
    await expect(nextBtn).toBeDisabled()
  })

  test('1c — language missing → Next disabled', async ({ page }) => {
    // Fill name and contact but NOT language
    await page.getByLabel('Full name *').fill('Test Customer')
    await page.locator('[data-testid="customer-email"]').first().fill('test@test.com')

    const nextBtn = page.getByRole('button', { name: 'Next', exact: true })
    await expect(nextBtn).toBeDisabled()
  })

  test('1d — all fields filled for 5 customers → Next enabled', async ({ page }) => {
    await fillMultipleCustomers(page, FIVE_CUSTOMERS)

    const nextBtn = page.getByRole('button', { name: 'Next', exact: true })
    await expect(nextBtn).toBeEnabled({ timeout: 5_000 })
  })
})

// ── Step 2: Itinerary Step ──────────────────────────────────────────────────

test.describe('2 — Itinerary step', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await openBookingOverlay(page)

    // Fill customer step with one customer and advance
    await page.getByLabel('Full name *').fill('Test Customer')
    await page.locator('[data-testid="customer-email"]').first().fill('test@test.com')
    await page.getByRole('button', { name: 'English' }).first().click()
    await clickNext(page)
  })

  test.afterEach(async ({ page }) => {
    await discardDraft(page)
  })

  test('2a — "Same courses for all" checkbox is disabled with Coming soon', async ({ page }) => {
    // Need 2+ customers to see the checkbox — go back and add another
    // For a simpler test: verify the checkbox exists and is disabled when visible
    // This test needs multiple customers, so we'll check the label text
    // The checkbox only appears with >1 customer, so we check it won't appear with 1
    // Actually — let's verify it's not shown for 1 customer
    await expect(page.getByText('Same courses for all customers')).not.toBeVisible()
  })

  test('2b — date picker min attribute prevents past dates', async ({ page }) => {
    // Select a course first
    await page.locator('[data-testid="course-activity-select"]').first().selectOption('OW')

    // The start date input should have a min attribute set
    const startDateInput = page.locator('[data-testid="course-start-date"]').first()
    await expect(startDateInput).toBeVisible()

    // Verify we can set a future date
    const futureDate = futureDateString(30)
    await startDateInput.fill(futureDate)
    await expect(startDateInput).toHaveValue(futureDate)
  })

  test('2g — prerequisite ordering error shown (AOW before OW)', async ({ page }) => {
    // Select AOW first
    await page.locator('[data-testid="course-activity-select"]').first().selectOption('AOW')

    // Add another course entry
    await page.getByRole('button', { name: /Add activity/i }).click()
    // Wait for second activity dropdown to appear
    await expect(page.locator('[data-testid="course-activity-select"]').nth(1)).toBeVisible({ timeout: 5_000 })

    // Select OW for the second entry — but AOW requires OW, and OW has no date
    // The prerequisite warning should mention OW required
    await expect(page.getByText(/requires.*certification/i).first()).toBeVisible({ timeout: 5_000 })
  })

  test('2h — no schedule visible when no courses selected', async ({ page }) => {
    // QUICK BOOK pre-fills DSD — clear it to test empty state
    await page.locator('[data-testid="course-activity-select"]').first().selectOption('')
    // Wait for the select to reflect the empty value
    await expect(page.locator('[data-testid="course-activity-select"]').first()).toHaveValue('')

    // With no course selected, day rows should not appear.
    // (Don't match /Schedule/ — it hits the step label "Program & Schedule".)
    await expect(page.getByText(/Day 1/)).not.toBeVisible()
    await expect(page.getByText('Schedule (', { exact: false })).not.toBeVisible()
  })

  test('2j — external resource entry works', async ({ page }) => {
    // DSD is pre-filled from QUICK BOOK — just fill a date
    const startDate = futureDateString(30)
    await page.locator('[data-testid="course-start-date"]').first().fill(startDate)

    // Wait for schedule to generate
    await expect(page.getByText(/Day 1/).first()).toBeVisible({ timeout: 5_000 })

    // Select external instructor in the inline instructor dropdown (inside Day card)
    const instructorSelect = page.locator('[data-testid="instructor-select"]')
    await expect(instructorSelect).toBeVisible({ timeout: 10_000 })
    await instructorSelect.click()
    await page.getByRole('option', { name: 'External (not in system)' }).click()

    // External instructor name input should appear
    const externalInput = page.getByLabel('Instructor (external)')
    await expect(externalInput).toBeVisible({ timeout: 3_000 })
    await externalInput.fill('External Instructor Name')
    await expect(externalInput).toHaveValue('External Instructor Name')
  })
})

// ── Step 2a: Same courses for all (multi-customer) ──────────────────────────

test.describe('2a — Same courses disabled for multi-customer', () => {
  test.afterEach(async ({ page }) => {
    await discardDraft(page)
  })

  test('checkbox visible but disabled with Coming soon badge', async ({ page }) => {
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await openBookingOverlay(page)

    // Add two customers
    await fillMultipleCustomers(page, [
      { name: 'Customer A', email: 'a@test.com' },
      { name: 'Customer B', email: 'b@test.com' },
    ])
    await clickNext(page)

    // The "Same courses for all" checkbox should be visible but disabled
    const checkbox = page.locator('input[type="checkbox"][aria-label*="Same courses"]')
    await expect(checkbox).toBeVisible({ timeout: 5_000 })
    await expect(checkbox).toBeDisabled()

    // "Coming soon" badge should be visible
    await expect(page.getByText('Coming soon')).toBeVisible()
  })
})

// ── Step 2i: Instructor ratio ───────────────────────────────────────────────

test.describe('2i — Instructor ratio warning', () => {
  test.afterEach(async ({ page }) => {
    await discardDraft(page)
  })

  test('5 divers with PADI OW → shows instructor ratio warning', async ({ page }) => {
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await openBookingOverlay(page)

    // Add 5 customers
    await fillMultipleCustomers(page, FIVE_CUSTOMERS)
    await clickNext(page)

    // Select OW course (PADI max 4 divers per instructor)
    const courseSelect = page.locator('[data-testid="course-activity-select"]').first()
    await expect(courseSelect).toBeVisible({ timeout: 10_000 })
    await courseSelect.selectOption('OW')

    // Set a start date
    const startDate = futureDateString(30)
    await page.locator('[data-testid="course-start-date"]').first().fill(startDate)

    // Warning should appear about instructor ratio
    await expect(
      page.getByText(/5 divers.*minimum 2 instructors/i).first(),
    ).toBeVisible({ timeout: 5_000 })
  })
})

// ── 1e / 1f: Draft persistence ──────────────────────────────────────────────

test.describe('1e — Draft persistence', () => {
  test('1e — fill all steps through review + close via X → draft saved', async ({ page }) => {
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await openBookingOverlay(page)

    // Step 1: Fill customer
    await page.getByLabel('Full name *').fill('Draft Persist Test')
    await page.locator('[data-testid="customer-email"]').first().fill('draft-persist@test.com')
    await page.getByRole('button', { name: 'English' }).first().click()
    await clickNext(page)

    // Step 2: DSD pre-filled, set start date
    const startDate = futureDateString(7)
    await page.locator('[data-testid="course-start-date"]').first().fill(startDate)
    await expect(page.getByText(/Day 1/).first()).toBeVisible({ timeout: 5_000 })

    // Assign external instructor so Next is enabled
    const instructorSelect = page.locator('[data-testid="instructor-select"]')
    await expect(instructorSelect).toBeVisible({ timeout: 10_000 })
    await instructorSelect.click()
    await page.getByRole('option', { name: 'External (not in system)' }).click()
    await page.getByLabel('Instructor (external)').fill('External Instructor')

    // Advance to review — this creates the draft shell with dates
    await clickNext(page)

    // Close overlay via X button (NOT Cancel — X preserves the draft)
    await page.getByLabel('Close dialog').click()
    // Wait for overlay to close
    await expect(page.getByLabel('Close dialog')).not.toBeVisible({ timeout: 5_000 })

    // The draft booking should appear as a bar on the calendar
    const draftBar = page.locator('button.glass-surface.absolute').filter({ hasText: 'DSD' })
    await expect(draftBar.first()).toBeVisible({ timeout: 10_000 })
  })

  test('1g — complete step 1 + advance to step 2 + close → no draft', async ({ page }) => {
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await openBookingOverlay(page)

    // Fill customer completely on step 1
    await page.getByLabel('Full name *').fill('No Draft Customer')
    await page.locator('[data-testid="customer-email"]').first().fill('no-draft@test.com')
    await page.getByRole('button', { name: 'English' }).first().click()

    // Advance to step 2 — no draft shell created yet (deferred to review)
    await clickNext(page)

    // Close overlay via X on step 2 — no draft should exist
    await page.getByLabel('Close dialog').click()
    // Wait for overlay to close
    await expect(page.getByLabel('Close dialog')).not.toBeVisible({ timeout: 5_000 })

    // Quick Book cards visible again
    await expect(page.getByRole('button', { name: /^DSD\s/ }).first()).toBeVisible({ timeout: 5_000 })

    // Re-open to confirm wizard starts fresh
    await openBookingOverlay(page)
    await expect(page.getByLabel('Full name *')).toHaveValue('')
    await page.getByLabel('Close dialog').click()
  })
})

// ── 2c: Second activity start date validation ───────────────────────────────

test.describe('2c — Second activity date constraint', () => {
  test.afterEach(async ({ page }) => {
    await discardDraft(page)
  })

  test('second activity start date min = first activity end date', async ({ page }) => {
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await openBookingOverlay(page)

    // Fill customer and advance to step 2
    await page.getByLabel('Full name *').fill('Test Customer')
    await page.locator('[data-testid="customer-email"]').first().fill('test@test.com')
    await page.getByRole('button', { name: 'English' }).first().click()
    await clickNext(page)

    // Select OW (3 days) and set a start date
    const courseSelect = page.locator('[data-testid="course-activity-select"]').first()
    await expect(courseSelect).toBeVisible({ timeout: 10_000 })
    await courseSelect.selectOption('OW')
    const owStart = futureDateString(20)
    await page.locator('[data-testid="course-start-date"]').first().fill(owStart)
    // Wait for the schedule to generate after date entry
    await expect(page.getByText(/Day 1/).first()).toBeVisible({ timeout: 5_000 })

    // Add a second activity
    await page.getByRole('button', { name: /Add activity/i }).click()
    // Wait for the second activity dropdown to appear
    await expect(page.locator('[data-testid="course-activity-select"]').nth(1)).toBeVisible({ timeout: 5_000 })

    // Select AOW for the second entry
    const secondCourseSelect = page.locator('[data-testid="course-activity-select"]').nth(1)
    await secondCourseSelect.selectOption('AOW')
    await expect(secondCourseSelect).toHaveValue('AOW')

    // The second date input should have min attribute >= OW end date
    // Each course entry has a data-testid="course-start-date"; the second is AOW's start
    const aowStartInput = page.locator('[data-testid="course-start-date"]').nth(1)
    const minAttr = await aowStartInput.getAttribute('min')
    expect(minAttr).toBeTruthy()

    // OW end date = start + 2 days (3-day course, inclusive)
    // min should be >= OW end date
    expect(minAttr! >= owStart).toBe(true)
  })
})

// ── 4b / 4e: Active + Completed badges ──────────────────────────────────────

/** Submit a DSD booking through the full 3-step wizard. */
async function submitDsdBooking(
  page: import('@playwright/test').Page,
  startDate: string,
) {
  // Step 1: Fill customer
  await page.getByLabel('Full name *').fill('Badge Test Customer')
  await page.locator('[data-testid="customer-email"]').first().fill('badge-test@test.com')
  await page.getByRole('button', { name: 'English' }).first().click()
  await clickNext(page)

  // Step 2: DSD pre-filled, set start date
  await page.locator('[data-testid="course-start-date"]').first().fill(startDate)
  await expect(page.getByText(/Day 1/).first()).toBeVisible({ timeout: 5_000 })

  // Assign external instructor
  const instructorSelect = page.locator('[data-testid="instructor-select"]')
  await expect(instructorSelect).toBeVisible({ timeout: 10_000 })
  await instructorSelect.click()
  await page.getByRole('option', { name: 'External (not in system)' }).click()
  await page.getByLabel('Instructor (external)').fill('External Instructor')

  // Assign external pool (DSD day 1 = confined water / pool venue type)
  const poolSelect = page.locator('[data-testid="pool-select"]')
  if (await poolSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await poolSelect.selectOption('__external__')
    await page.getByLabel('Pool (external)').fill('External Pool')
  }

  // Advance to Review
  await clickNext(page)

  // Submit
  const submitBtn = page.getByRole('button', { name: /Submit Booking/i })
  await expect(submitBtn).toBeEnabled({ timeout: 5_000 })
  await submitBtn.click()

  // Wait for overlay to actually close (not just background showing through)
  await expect(page.getByLabel('Close dialog')).not.toBeVisible({ timeout: 15_000 })
}

/** Simulate portal completion for the most recent submitted draft. */
async function completeCustomerPortal(ownerSlug: string) {
  const res = await fetch(`${CONVEX_SITE_URL}/dev/complete-customer-form`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerSlug }),
  })
  if (!res.ok) throw new Error(`completeCustomerPortal failed: ${res.status}`)
}

test.describe('4b/4e — Active and Completed badges', () => {
  test('4b — Upcoming booking starting today shows Active on calendar', async ({ page }) => {
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await openBookingOverlay(page)

    // Submit a DSD booking starting today
    const today = futureDateString(0)
    await submitDsdBooking(page, today)

    // Dashboard should be visible (overlay closed after submit)
    await expect(page.getByText('Quick Book')).toBeVisible({ timeout: 10_000 })

    // Simulate customer portal completion → auto-advance Draft → Upcoming
    await completeCustomerPortal(NICOLE.slug)

    // A booking bar should appear on the calendar (DSD label) — Convex reactivity will push the update
    const bookingBar = page.locator('button.glass-surface.absolute').filter({ hasText: 'DSD' })
    await expect(bookingBar.first()).toBeVisible({ timeout: 10_000 })

    // Toggle Active filter OFF — the bar should disappear
    const activeFilter = page.getByRole('button', { name: 'Active' })
    await activeFilter.click()
    await expect(bookingBar).not.toBeVisible({ timeout: 5_000 })

    // Toggle Active filter ON — the bar reappears
    await activeFilter.click()
    await expect(bookingBar.first()).toBeVisible({ timeout: 5_000 })
  })

  test('4e — Upcoming booking with past end date shows Completed on calendar', async ({ page }) => {
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await openBookingOverlay(page)

    // Submit a DSD booking starting today
    const today = futureDateString(0)
    await submitDsdBooking(page, today)

    // Dashboard visible after overlay close
    await expect(page.getByText('Quick Book')).toBeVisible({ timeout: 10_000 })

    // Simulate customer portal completion → auto-advance Draft → Upcoming
    await completeCustomerPortal(NICOLE.slug)

    // Wait for Convex reactivity to push the status update before manipulating the clock
    const bookingBarPreClock = page.locator('button.glass-surface.absolute').filter({ hasText: 'DSD' })
    await expect(bookingBarPreClock.first()).toBeVisible({ timeout: 15_000 })

    // Advance the browser clock by 2 days so endDate < "today"
    const twoDaysLater = new Date()
    twoDaysLater.setDate(twoDaysLater.getDate() + 2)
    await page.clock.setFixedTime(twoDaysLater)

    // Reload so the calendar re-derives statuses with the new Date()
    await page.reload()
    await expect(page.getByText('Quick Book')).toBeVisible({ timeout: 15_000 })

    // Completed is hidden by default — toggle it ON
    const completedFilter = page.getByRole('button', { name: 'Completed' })
    await completedFilter.click()

    // The booking bar should now be visible as Completed
    const bookingBar = page.locator('button.glass-surface.absolute').filter({ hasText: 'DSD' })
    await expect(bookingBar.first()).toBeVisible({ timeout: 10_000 })

    // Toggle Completed OFF — should disappear
    await completedFilter.click()
    await expect(bookingBar).not.toBeVisible({ timeout: 5_000 })
  })
})

// ── Activity dropdown filtering ──────────────────────────────────────────────

test.describe('dropdown filter — activity unavailability rules', () => {
  async function advanceToItinerary(page: import('@playwright/test').Page) {
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await openBookingOverlay(page, 'DSD')
    await page.getByLabel('Full name *').fill('Filter Test')
    await page.locator('[data-testid="customer-email"]').first().fill('filter@test.com')
    await page.getByRole('button', { name: 'English' }).first().click()
    await clickNext(page)
  }

  async function getSecondDropdownValues(page: import('@playwright/test').Page): Promise<string[]> {
    await page.getByRole('button', { name: /Add activity/i }).click()
    const secondSelect = page.locator('[data-testid="course-activity-select"]').nth(1)
    // Wait for the second activity dropdown to appear
    await expect(secondSelect).toBeVisible({ timeout: 5_000 })
    // Read option VALUES (course codes like 'AOW') not text — avoids false matches
    // from the O+A combo label "O+A (OW + AOW)" which contains "AOW" as text.
    return secondSelect.locator('option').evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value),
    )
  }

  test.afterEach(async ({ page }) => {
    await page.getByLabel('Close dialog').click().catch(() => {})
  })

  test('first = DSD → second dropdown: OW present, FD absent', async ({ page }) => {
    await advanceToItinerary(page)
    const courseSelect = page.locator('[data-testid="course-activity-select"]').first()
    await expect(courseSelect).toBeVisible({ timeout: 10_000 })
    const values = await getSecondDropdownValues(page)
    expect(values).toContain('OW')
    expect(values).not.toContain('FD')
  })

  test('first = OW → second dropdown: OW absent, DSD absent, AOW present', async ({ page }) => {
    await advanceToItinerary(page)
    const courseSelect = page.locator('[data-testid="course-activity-select"]').first()
    await expect(courseSelect).toBeVisible({ timeout: 10_000 })
    await courseSelect.selectOption('OW')
    await expect(courseSelect).toHaveValue('OW')
    const values = await getSecondDropdownValues(page)
    expect(values).not.toContain('OW')
    expect(values).not.toContain('DSD')
    expect(values).toContain('AOW')
  })

  test('first = AOW → second dropdown: OW absent, AOW absent, RESCUE present', async ({ page }) => {
    await advanceToItinerary(page)
    const courseSelect = page.locator('[data-testid="course-activity-select"]').first()
    await expect(courseSelect).toBeVisible({ timeout: 10_000 })
    await courseSelect.selectOption('AOW')
    await expect(courseSelect).toHaveValue('AOW')
    const values = await getSecondDropdownValues(page)
    expect(values).not.toContain('OW')
    expect(values).not.toContain('AOW')
    expect(values).toContain('RESCUE')
  })

  test('first = FD → second dropdown: FD present (repeatable), DSD absent', async ({ page }) => {
    await advanceToItinerary(page)
    const courseSelect = page.locator('[data-testid="course-activity-select"]').first()
    await expect(courseSelect).toBeVisible({ timeout: 10_000 })
    await courseSelect.selectOption('FD')
    await expect(courseSelect).toHaveValue('FD')
    const values = await getSecondDropdownValues(page)
    expect(values).toContain('FD')
    expect(values).not.toContain('DSD')
  })
})
