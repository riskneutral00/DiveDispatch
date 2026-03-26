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

  it('does not call setDropConfirmation in a bare if-block outside useEffect', () => {
    const componentStart = source.indexOf('export function DashboardContent')
    expect(componentStart).toBeGreaterThan(-1)

    const afterExport = source.slice(componentStart)

    // The banned pattern: a bare if-block at the component top level that
    // calls setDropConfirmation — this causes setState during render.
    const hasBareRenderPhaseSetState =
      /\/\/ When availability.*\n\s*if \(dropConfirmation && !dropConfirmation\.conflicts && availabilityResult\) \{\n\s*setDropConfirmation/.test(
        afterExport,
      )

    expect(hasBareRenderPhaseSetState).toBe(false)
  })

  it('wraps the availability-to-confirmation sync in a useEffect with setDropConfirmation', () => {
    // The fix must place setDropConfirmation inside a useEffect, not at the top
    // level of the component body. Check that a useEffect exists containing the call.
    const useEffectWithSetDrop =
      /useEffect\(\s*\(\)\s*=>\s*\{[^}]*setDropConfirmation/s.test(source)

    expect(useEffectWithSetDrop).toBe(true)
  })
})
