// @vitest-environment jsdom
/**
 * Portal Page Touch Targets (DD-162)
 *
 * Verifies that the portal completed page and equipment step use Button
 * (which enforces 44px min touch targets) instead of ad-hoc <button> elements.
 *
 * This is a source-level compliance test: we parse the page source to confirm
 * ad-hoc buttons have been replaced with Button imports.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const PORTAL_PAGE_PATH = resolve(
  __dirname,
  '../../src/app/(portal)/portal/[token]/page.tsx',
)

describe('Portal page Button compliance (DD-162)', () => {
  const source = readFileSync(PORTAL_PAGE_PATH, 'utf-8')

  it('imports Button', () => {
    expect(source).toMatch(/import\s+.*Button.*from/)
  })

  it('does not use ad-hoc <button> elements with inline styles', () => {
    // After the fix, all interactive buttons should be Button.
    // Ad-hoc buttons have pattern: <button ... style={{ background: ...
    const adHocButtonPattern = /<button[\s\S]*?style=\{\{[\s\S]*?background:/g
    const matches = source.match(adHocButtonPattern)
    expect(matches).toBeNull()
  })

  it('"Close" action uses Button', () => {
    const precedingChunk = source.slice(
      Math.max(0, source.indexOf('window.close') - 300),
      source.indexOf('window.close'),
    )
    expect(precedingChunk).toMatch(/Button/)
  })

  it('"Continue" action in equipment step uses Button', () => {
    // The equipment step wraps content in PortalStepShell, which uses Button for Continue.
    const continueIdx = source.indexOf("'safety')")
    const precedingChunk = source.slice(
      Math.max(0, continueIdx - 400),
      continueIdx,
    )
    expect(precedingChunk).toMatch(/Button|PortalStepShell/)
  })
})
