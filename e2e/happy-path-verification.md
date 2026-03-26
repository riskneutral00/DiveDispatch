# Happy Path E2E Verification Report

**Date:** 2026-03-26
**Branch:** main (worktree DD-worktree-171)
**Unit tests:** 1893/1893 passing (152 test files)

---

## Scene Results

### Scene 1: DC Onboarding
**File:** `walkthrough/06-onboarding-preferences.spec.ts`
**Status:** FAIL (3/3 tests failing)

| Test | Result | Error |
|------|--------|-------|
| preference pills are selectable | FAIL | `toBeVisible` timeout on `getByText('App language')` |
| skip works and advances to Review | FAIL | Same root cause |
| Continue with pills selected advances to Review | FAIL | Same root cause |

**Root cause:** The account setup wizard step order has changed. The test expects "App language" as the first step, but the UI now lands on "What's your role?" (role selection). The wizard flow was refactored and the E2E tests were not updated to match the new step order.

---

### Scene 2: First Real Booking
**File:** `booking-flow.spec.ts`
**Status:** FAIL (3/3 tests failing)

| Test | Result | Error |
|------|--------|-------|
| operator creates a booking -- happy path | FAIL | `toBeVisible` timeout on `getByLabel('Full name *')` |
| booking appears in operator dashboard after creation | FAIL | Same root cause |
| inventory conflict: same instructor double-booked on same date | FAIL | Same root cause |

**Root cause:** Clicking the "+ Booking" button on the dashboard does not open the booking wizard overlay. The button is visible and clickable, but the overlay with the customer form (containing "Full name *" label) never appears. This affects every test that depends on the booking wizard.

**Note:** This scene has no "send portal link" step -- it covers booking creation only, not the full booking-to-portal handoff.

---

### Scene 3: Customer Portal
**File:** `portal-flow.spec.ts`
**Status:** FAIL (3/3 tests failing)

| Test | Result | Error |
|------|--------|-------|
| customer completes all portal steps and submits | FAIL | `toBeVisible` timeout on `getByLabel('Full name *')` in portal helper |
| re-visiting portal URL shows completed state | FAIL | Same root cause |
| contact form validation blocks advance when required fields empty | FAIL | Same root cause |

**Root cause:** Same as Scene 2. The portal tests first create a booking via the wizard (using `createBookingAndGetPortalToken` helper), which fails because the booking overlay does not open. The portal pages themselves load correctly (verified by smoke tests: `portal expired page loads`, `portal shows expired for bad token`, `portal loads with valid token` -- all PASS).

---

### Scene 4: Auto-Advance to Upcoming
**File:** `walkthrough/23-verify-upcoming.spec.ts`
**Status:** FAIL (2/2 tests failing)

| Test | Result | Error |
|------|--------|-------|
| DC dashboard shows booking bar after full sequence | FAIL | `toBeVisible` timeout on `getByLabel('Full name *')` |
| booking status displays as Upcoming | FAIL | Same root cause |

**Root cause:** Same booking wizard overlay issue as Scenes 2 and 3. The full sequence (create booking -> portal -> stakeholder accept -> auto-advance) cannot start because the first step (booking creation) fails.

---

### Scene 5: Dive Day Completion
**File:** None
**Status:** GAP -- no E2E test exists

No E2E test covers the dive day completion flow (marking a booking as completed after the dive day passes).

---

## Summary

| Scene | File | Tests | Pass | Fail | Gap |
|-------|------|-------|------|------|-----|
| 1. DC Onboarding | walkthrough/06-onboarding-preferences.spec.ts | 3 | 0 | 3 | |
| 2. First Real Booking | booking-flow.spec.ts | 3 | 0 | 3 | |
| 3. Customer Portal | portal-flow.spec.ts | 3 | 0 | 3 | |
| 4. Auto-Advance to Upcoming | walkthrough/23-verify-upcoming.spec.ts | 2 | 0 | 2 | |
| 5. Dive Day Completion | -- | 0 | 0 | 0 | No E2E |
| **Total** | | **11** | **0** | **11** | **1 gap** |

## Systemic Issues

Two distinct root causes block all 5 scenes:

1. **Booking wizard overlay does not open** (affects Scenes 2, 3, 4): The "+ Booking" button on the dashboard is visible and receives the click, but the overlay containing the customer form never renders. This is the single blocker for 8 of 11 tests.

2. **Account setup wizard step order changed** (affects Scene 1): Tests expect "App language" as the first wizard step, but the UI now shows "What's your role?" first. The wizard step sequence was refactored without updating the E2E tests.

## Smoke Tests (Baseline)

The smoke suite confirms infrastructure is healthy -- 12/13 passing, 1 skipped:
- Public pages (landing, sign-in): PASS
- Auth redirects: PASS
- Role dashboards (DiveCenter, Instructor, multi-role, Agent): PASS
- Portal pages (expired, bad token, valid token): PASS
