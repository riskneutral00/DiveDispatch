// @vitest-environment jsdom
/**
 * Portal Page Touch Targets (DD-162)
 *
 * Verifies that the portal completed page and equipment step use GlassButton
 * (which enforces 44px min touch targets) instead of ad-hoc <button> elements.
 *
 * This is a source-level compliance test: we parse the page source to confirm
 * ad-hoc buttons have been replaced with GlassButton imports.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const PORTAL_PAGE_PATH = resolve(
  __dirname,
  '../../src/app/(portal)/portal/[token]/page.tsx',
)

describe('Portal page GlassButton compliance (DD-162)', () => {
  const source = readFileSync(PORTAL_PAGE_PATH, 'utf-8')

  it('imports GlassButton', () => {
    expect(source).toMatch(/import\s+.*GlassButton.*from/)
  })

  it('does not use ad-hoc <button> elements with inline styles', () => {
    // After the fix, all interactive buttons should be GlassButton.
    // Ad-hoc buttons have pattern: <button ... style={{ background: ...
    const adHocButtonPattern = /<button[\s\S]*?style=\{\{[\s\S]*?background:/g
    const matches = source.match(adHocButtonPattern)
    expect(matches).toBeNull()
  })

  it('"Close" action uses GlassButton', () => {
    // The completed state should use <GlassButton for the close action
    // Search for window.close in proximity to GlassButton, not raw <button>
    const closeSection = source.slice(
      source.indexOf('window.close'),
      source.indexOf('window.close') + 200,
    )
    // Should NOT be wrapped in a raw <button
    const precedingChunk = source.slice(
      Math.max(0, source.indexOf('window.close') - 300),
      source.indexOf('window.close'),
    )
    expect(precedingChunk).toMatch(/GlassButton/)
  })

  it('"Continue" action in equipment step uses GlassButton', () => {
    // The equipment step should use GlassButton for "Continue"
    const continueIdx = source.indexOf("'safety')")
    // Find the last GlassButton or <button before the Continue text
    const precedingChunk = source.slice(
      Math.max(0, continueIdx - 400),
      continueIdx,
    )
    expect(precedingChunk).toMatch(/GlassButton/)
  })
})
