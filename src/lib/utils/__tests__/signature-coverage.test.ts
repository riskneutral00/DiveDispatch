import { describe, it, expect } from 'vitest'
import {
  computeSignatureCoverage,
  isSignatureValid,
  SIGNATURE_COVERAGE_THRESHOLD,
} from '../signature-coverage'

/**
 * Helper: create an ImageData-like object with the given RGBA pixel array.
 * Each pixel is 4 values: [R, G, B, A].
 * A pixel is "drawn" if alpha > 0.
 */
function makeImageData(
  width: number,
  height: number,
  filledPixels: number,
): ImageData {
  const totalPixels = width * height
  const data = new Uint8ClampedArray(totalPixels * 4)

  // Fill the first `filledPixels` with opaque black (R=0, G=0, B=0, A=255)
  for (let i = 0; i < filledPixels && i < totalPixels; i++) {
    const offset = i * 4
    data[offset + 3] = 255 // alpha
  }
  // Remaining pixels stay at alpha = 0 (transparent)

  return { data, width, height, colorSpace: 'srgb' }
}

describe('computeSignatureCoverage', () => {
  it('returns 0 for a completely blank canvas', () => {
    const imageData = makeImageData(100, 100, 0)
    expect(computeSignatureCoverage(imageData)).toBe(0)
  })

  it('returns 1 for a fully filled canvas', () => {
    const imageData = makeImageData(100, 100, 10_000)
    expect(computeSignatureCoverage(imageData)).toBe(1)
  })

  it('returns correct ratio for partially filled canvas', () => {
    // 500 filled out of 10000 = 5%
    const imageData = makeImageData(100, 100, 500)
    expect(computeSignatureCoverage(imageData)).toBeCloseTo(0.05, 4)
  })

  it('returns correct ratio for 1% coverage', () => {
    const imageData = makeImageData(100, 100, 100)
    expect(computeSignatureCoverage(imageData)).toBeCloseTo(0.01, 4)
  })

  it('handles a single pixel', () => {
    const imageData = makeImageData(100, 100, 1)
    expect(computeSignatureCoverage(imageData)).toBeCloseTo(0.0001, 4)
  })
})

describe('isSignatureValid', () => {
  it('rejects a blank canvas', () => {
    const imageData = makeImageData(100, 100, 0)
    expect(isSignatureValid(imageData)).toBe(false)
  })

  it('rejects a single-pixel tap (well below threshold)', () => {
    const imageData = makeImageData(100, 100, 1)
    expect(isSignatureValid(imageData)).toBe(false)
  })

  it('rejects a tiny mark below the threshold', () => {
    // 100 pixels = 1% of 10000, threshold is 2%
    const imageData = makeImageData(100, 100, 100)
    expect(isSignatureValid(imageData)).toBe(false)
  })

  it('accepts a signature at exactly the threshold', () => {
    // 200 pixels = 2% of 10000
    const imageData = makeImageData(100, 100, 200)
    expect(isSignatureValid(imageData)).toBe(true)
  })

  it('accepts a full signature well above threshold', () => {
    const imageData = makeImageData(100, 100, 1000)
    expect(isSignatureValid(imageData)).toBe(true)
  })

  it('respects a custom threshold', () => {
    // 500 pixels = 5% coverage
    const imageData = makeImageData(100, 100, 500)
    // With 10% threshold, 5% should fail
    expect(isSignatureValid(imageData, 0.10)).toBe(false)
    // With 3% threshold, 5% should pass
    expect(isSignatureValid(imageData, 0.03)).toBe(true)
  })

  it('handles non-square canvas dimensions', () => {
    // 200x50 = 10000 pixels. 200 filled = 2%
    const imageData = makeImageData(200, 50, 200)
    expect(isSignatureValid(imageData)).toBe(true)
  })
})

describe('SIGNATURE_COVERAGE_THRESHOLD', () => {
  it('is 2% (0.02)', () => {
    expect(SIGNATURE_COVERAGE_THRESHOLD).toBe(0.02)
  })
})
