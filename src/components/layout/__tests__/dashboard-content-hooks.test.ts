/**
 * DashboardContent — Rules of Hooks structural test
 *
 * Verifies that the exported DashboardContent function does not call any React
 * hooks before an early return, which would violate React's Rules of Hooks.
 * The fix pattern: thin wrapper does the guard, inner component holds all hooks.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const SRC = readFileSync(
  resolve(__dirname, '../dashboard-content.tsx'),
  'utf-8',
)

describe('DashboardContent Rules of Hooks compliance', () => {
  it('exported DashboardContent does not call any hooks', () => {
    // Extract the body of the exported DashboardContent function.
    // It should be a thin wrapper: roleConfig lookup, guard, render inner.
    const exportMatch = SRC.match(
      /export function DashboardContent\b[^{]*\{([\s\S]*?)^\}/m,
    )
    expect(exportMatch).not.toBeNull()

    const wrapperBody = exportMatch![1]

    // No hook calls (useXxx pattern) should appear in the wrapper body
    const hookCalls = wrapperBody.match(/\buse[A-Z]\w*\s*\(/g)
    expect(hookCalls).toBeNull()
  })

  it('DashboardContentInner exists and receives roleConfig prop', () => {
    // The inner component must be defined (not exported)
    expect(SRC).toMatch(/function DashboardContentInner\b/)
    // It must NOT be exported
    expect(SRC).not.toMatch(/export\s+(default\s+)?function DashboardContentInner\b/)
    // It must accept roleConfig in its props
    expect(SRC).toMatch(/DashboardContentInner.*roleConfig/)
  })

  it('wrapper still guards against undefined roleConfig', () => {
    const exportMatch = SRC.match(
      /export function DashboardContent\b[^{]*\{([\s\S]*?)^\}/m,
    )
    const wrapperBody = exportMatch![1]

    // Must contain a null/return guard for roleConfig
    expect(wrapperBody).toMatch(/if\s*\(\s*!roleConfig\s*\)\s*return\s+null/)
  })
})
