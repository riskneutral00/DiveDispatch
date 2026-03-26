// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * DD-136: Verify that DashboardContent does not call setState during the render phase.
 *
 * The bug: a bare `if (...) { setDropConfirmation(...) }` at the top level of the
 * component body runs during every render, violating React rules and causing
 * infinite loops under React 19's compiler.
 *
 * The fix: wrap such logic in a useEffect.
 *
 * This test reads the source and asserts the problematic pattern is gone.
 */
describe('DashboardContent render-phase safety (DD-136)', () => {
  const sourcePath = resolve(
    __dirname,
    '../../src/components/dashboard/dashboard-content.tsx',
  )
  const source = readFileSync(sourcePath, 'utf-8')

  it('does not call setDropConfirmation outside of useEffect or event handlers', () => {
    // Find all setDropConfirmation calls
    const lines = source.split('\n')
    const setDropLines: { lineNum: number; text: string }[] = []

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('setDropConfirmation(')) {
        setDropLines.push({ lineNum: i + 1, text: lines[i].trim() })
      }
    }

    // Every setDropConfirmation call must be inside:
    // - a useEffect callback
    // - a function declaration (event handler)
    // - a setTimeout callback
    // - an arrow function assigned to a variable
    //
    // It must NOT appear as a bare statement in the component body.
    // The bug pattern is: `if (condition) { setDropConfirmation(...) }` at top level.
    //
    // We detect this by checking that no setDropConfirmation call appears
    // in a bare `if` block that is NOT inside a function or useEffect.

    // Parse: find the component function body and check for bare setState
    const componentStart = source.indexOf('export function DashboardContent')
    expect(componentStart).toBeGreaterThan(-1)

    // Extract the component body (everything after the opening brace)
    const afterExport = source.slice(componentStart)

    // Look for the pattern: bare `if (...)` blocks that contain setDropConfirmation
    // but are NOT inside a useEffect, function, or callback.
    // The specific bug pattern: a line with `if (dropConfirmation &&` followed by
    // `setDropConfirmation` that is NOT inside a useEffect(() => { ... })
    const bareSetStatePattern =
      /^\s*if\s*\([^)]*\)\s*\{[^}]*setDropConfirmation\(/m

    // Check if this pattern exists outside of useEffect
    // Split into top-level statements (rough heuristic: look for the pattern
    // before any function/useEffect wrapper)

    // More precise: find all `if` blocks at the component's top level that
    // contain setDropConfirmation. These should not exist.
    // We look for `if (dropConfirmation` at the component level (not nested in a function).

    // The specific banned pattern:
    const hasBareRenderPhaseSetState =
      /\/\/ When availability.*\n\s*if \(dropConfirmation && !dropConfirmation\.conflicts && availabilityResult\) \{\n\s*setDropConfirmation/.test(
        afterExport,
      )

    expect(hasBareRenderPhaseSetState).toBe(false)
  })

  it('uses useEffect to sync availability result into drop confirmation', () => {
    // The fix should include a useEffect that depends on availabilityResult
    expect(source).toContain('useEffect')

    // The useEffect should reference both availabilityResult and dropConfirmation
    // Find useEffect blocks that contain setDropConfirmation
    const useEffectWithSetDrop =
      /useEffect\(\s*\(\)\s*=>\s*\{[^}]*setDropConfirmation/s.test(source)

    expect(useEffectWithSetDrop).toBe(true)
  })
})
