import AxeBuilder from '@axe-core/playwright'
import { Page, expect } from '@playwright/test'

/**
 * Run axe-core accessibility checks on the current page.
 * Fails the test if any WCAG AA violations are found.
 *
 * Usage in a test:
 *   await checkAccessibility(page)
 *   await checkAccessibility(page, { exclude: ['.cl-rootBox'] })
 */
export async function checkAccessibility(
  page: Page,
  options?: { exclude?: string[] },
) {
  let builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])

  if (options?.exclude) {
    for (const selector of options.exclude) {
      builder = builder.exclude(selector)
    }
  }

  const results = await builder.analyze()

  // Format violations for readable test output
  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    nodes: v.nodes.length,
    targets: v.nodes.slice(0, 3).map((n) => n.target.join(' > ')),
  }))

  expect(violations, `Accessibility violations found:\n${JSON.stringify(violations, null, 2)}`).toEqual([])
}
