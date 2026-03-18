import { Page, expect } from '@playwright/test'

/**
 * Capture console errors during page interactions.
 * Call startCapture() before navigating, then assertNoErrors() after.
 *
 * Usage:
 *   const console = captureConsoleErrors(page)
 *   await page.goto('/dashboard')
 *   await page.waitForLoadState('networkidle')
 *   console.assertNoErrors()
 */
export function captureConsoleErrors(page: Page) {
  const errors: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })

  return {
    get errors() {
      return errors
    },

    assertNoErrors(options?: { ignore?: RegExp[] }) {
      const filtered = options?.ignore
        ? errors.filter((e) => !options.ignore!.some((re) => re.test(e)))
        : errors

      expect(
        filtered,
        `Console errors detected:\n${filtered.join('\n')}`,
      ).toEqual([])
    },
  }
}
