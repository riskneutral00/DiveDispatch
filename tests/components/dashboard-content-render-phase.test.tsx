// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * DD-136: Verify that the drop-confirmation availability sync does not call
 * setState during the render phase.
 *
 * The bug: a bare `if (...) { setDropConfirmation(...) }` at the top level of
 * a component/hook body runs during every render, violating React rules and
 * causing infinite loops under React 19's compiler.
 *
 * The fix: wrap such logic in a useEffect.
 *
 * After DD-148, this logic lives in useDragToDate (extracted hook).
 * This test reads both sources and asserts the problematic pattern is gone.
 */
describe('DashboardContent render-phase safety (DD-136)', () => {
  const dashboardPath = resolve(
    __dirname,
    '../../src/components/dashboard/dashboard-content.tsx',
  )
  const dragHookPath = resolve(
    __dirname,
    '../../src/lib/hooks/use-drag-to-date.ts',
  )
  const dashboardSource = readFileSync(dashboardPath, 'utf-8')
  const dragHookSource = readFileSync(dragHookPath, 'utf-8')

  it('does not call setDropConfirmation in a bare if-block outside useEffect', () => {
    // Check both the component and the hook for the banned pattern
    for (const source of [dashboardSource, dragHookSource]) {
      const hasBareRenderPhaseSetState =
        /\/\/ When availability.*\n\s*if \(dropConfirmation && !dropConfirmation\.conflicts && availabilityResult\) \{\n\s*setDropConfirmation/.test(
          source,
        )
      expect(hasBareRenderPhaseSetState).toBe(false)
    }
  })

  it('wraps the availability-to-confirmation sync in a useEffect with setDropConfirmation', () => {
    // The fix must place setDropConfirmation inside a useEffect. After DD-148,
    // this logic lives in useDragToDate hook, not in the component itself.
    const useEffectWithSetDrop =
      /useEffect\(\s*\(\)\s*=>\s*\{[^}]*setDropConfirmation/s.test(dragHookSource)

    expect(useEffectWithSetDrop).toBe(true)
  })
})
