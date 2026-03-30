import { describe, it, expect } from 'vitest'
import {
  computeSignatureCoverage,
  isSignatureValid,
  SIGNATURE_COVERAGE_THRESHOLD,
} from '../src/lib/utils/signature-coverage'

// Helper to create a mock ImageData-like object
function makeImageData(width: number, height: number, alphaValues: number[]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < alphaValues.length; i++) {
    data[i * 4 + 3] = alphaValues[i] // alpha channel
  }
  return { data, width, height, colorSpace: 'srgb' }
}

describe('computeSignatureCoverage', () => {
  it('returns 0 for a blank canvas (all alpha = 0)', () => {
    const img = makeImageData(2, 2, [0, 0, 0, 0])
    expect(computeSignatureCoverage(img)).toBe(0)
  })

  it('returns 1 for a fully filled canvas (all alpha > 0)', () => {
    const img = makeImageData(2, 2, [255, 255, 255, 255])
    expect(computeSignatureCoverage(img)).toBe(1)
  })

  it('returns 0.5 for half-filled canvas', () => {
    const img = makeImageData(2, 2, [255, 255, 0, 0])
    expect(computeSignatureCoverage(img)).toBe(0.5)
  })

  it('returns 0 for zero-dimension canvas', () => {
    const img = makeImageData(0, 0, [])
    expect(computeSignatureCoverage(img)).toBe(0)
  })

  it('counts alpha = 1 as drawn', () => {
    const img = makeImageData(1, 1, [1])
    expect(computeSignatureCoverage(img)).toBe(1)
  })

  it('returns correct fraction for 1 of 4 pixels', () => {
    const img = makeImageData(2, 2, [128, 0, 0, 0])
    expect(computeSignatureCoverage(img)).toBe(0.25)
  })
})

describe('isSignatureValid', () => {
  it('returns false for blank canvas', () => {
    const img = makeImageData(10, 10, new Array(100).fill(0))
    expect(isSignatureValid(img)).toBe(false)
  })

  it('returns true for fully drawn canvas', () => {
    const img = makeImageData(10, 10, new Array(100).fill(255))
    expect(isSignatureValid(img)).toBe(true)
  })

  it('returns false when coverage is below threshold', () => {
    // 1 of 100 pixels = 1% < 2% threshold
    const alphas = new Array(100).fill(0)
    alphas[0] = 255
    const img = makeImageData(10, 10, alphas)
    expect(isSignatureValid(img)).toBe(false)
  })

  it('returns true when coverage meets threshold', () => {
    // 2 of 100 pixels = 2% = threshold
    const alphas = new Array(100).fill(0)
    alphas[0] = 255
    alphas[1] = 255
    const img = makeImageData(10, 10, alphas)
    expect(isSignatureValid(img)).toBe(true)
  })

  it('uses custom threshold when provided', () => {
    // 50 of 100 pixels = 50%
    const alphas = new Array(100).fill(0)
    for (let i = 0; i < 50; i++) alphas[i] = 255
    const img = makeImageData(10, 10, alphas)
    expect(isSignatureValid(img, 0.6)).toBe(false)
    expect(isSignatureValid(img, 0.5)).toBe(true)
  })
})

describe('SIGNATURE_COVERAGE_THRESHOLD', () => {
  it('is 2%', () => {
    expect(SIGNATURE_COVERAGE_THRESHOLD).toBe(0.02)
  })
})
