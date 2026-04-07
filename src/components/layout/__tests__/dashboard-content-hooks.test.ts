import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const SRC = readFileSync(
  resolve(__dirname, '../dashboard-content.tsx'),
  'utf-8',
)

describe('DashboardContent Rules of Hooks compliance', () => {
  it('handleUrgentCancel guards against referral bookings', () => {
    expect(SRC).toMatch(/booking\?\.isReferral/)
    expect(SRC).toMatch(/if\s*\(\s*booking\?\.isReferral\s*\)\s*return/)
  })

  it('exported DashboardContent does not call any hooks', () => {
    const exportMatch = SRC.match(
      /export function DashboardContent\b[^{]*\{([\s\S]*?)^\}/m,
    )
    expect(exportMatch).not.toBeNull()

    const wrapperBody = exportMatch![1]

    const hookCalls = wrapperBody.match(/\buse[A-Z]\w*\s*\(/g)
    expect(hookCalls).toBeNull()
  })

  it('DashboardContentInner exists and receives roleConfig prop', () => {
    expect(SRC).toMatch(/function DashboardContentInner\b/)
    expect(SRC).not.toMatch(/export\s+(default\s+)?function DashboardContentInner\b/)
    expect(SRC).toMatch(/DashboardContentInner.*roleConfig/)
  })

  it('wrapper still guards against undefined roleConfig', () => {
    const exportMatch = SRC.match(
      /export function DashboardContent\b[^{]*\{([\s\S]*?)^\}/m,
    )
    const wrapperBody = exportMatch![1]

    expect(wrapperBody).toMatch(/if\s*\(\s*!roleConfig\s*\)\s*return\s+null/)
  })
})
