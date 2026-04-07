import { describe, it, expect } from 'vitest'
import {
  computeSignatureCoverage,
  isSignatureValid,
  SIGNATURE_COVERAGE_THRESHOLD,
} from '../signature-coverage'

function makeImageData(
  width: number,
  height: number,
  filledPixels: number,
): ImageData {
  const totalPixels = width * height
  const data = new Uint8ClampedArray(totalPixels * 4)

  for (let i = 0; i < filledPixels && i < totalPixels; i++) {
    const offset = i * 4
    data[offset + 3] = 255 // alpha
  }

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
    const imageData = makeImageData(100, 100, 100)
    expect(isSignatureValid(imageData)).toBe(false)
  })

  it('accepts a signature at exactly the threshold', () => {
    const imageData = makeImageData(100, 100, 200)
    expect(isSignatureValid(imageData)).toBe(true)
  })

  it('accepts a full signature well above threshold', () => {
    const imageData = makeImageData(100, 100, 1000)
    expect(isSignatureValid(imageData)).toBe(true)
  })

  it('respects a custom threshold', () => {
    const imageData = makeImageData(100, 100, 500)
    expect(isSignatureValid(imageData, 0.10)).toBe(false)
    expect(isSignatureValid(imageData, 0.03)).toBe(true)
  })

  it('handles non-square canvas dimensions', () => {
    const imageData = makeImageData(200, 50, 200)
    expect(isSignatureValid(imageData)).toBe(true)
  })
})

describe('SIGNATURE_COVERAGE_THRESHOLD', () => {
  it('is 2% (0.02)', () => {
    expect(SIGNATURE_COVERAGE_THRESHOLD).toBe(0.02)
  })
})

function makeImageDataAlpha(width: number, height: number, alphaValues: number[]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < alphaValues.length; i++) {
    data[i * 4 + 3] = alphaValues[i]
  }
  return { data, width, height, colorSpace: 'srgb' }
}

describe('computeSignatureCoverage (alpha channel samples)', () => {
  it('returns 0 for zero-dimension canvas', () => {
    const img = makeImageDataAlpha(0, 0, [])
    expect(computeSignatureCoverage(img)).toBe(0)
  })

  it('returns 0.5 for half-filled 2x2 canvas', () => {
    const img = makeImageDataAlpha(2, 2, [255, 255, 0, 0])
    expect(computeSignatureCoverage(img)).toBe(0.5)
  })

  it('counts alpha = 1 as drawn', () => {
    const img = makeImageDataAlpha(1, 1, [1])
    expect(computeSignatureCoverage(img)).toBe(1)
  })

  it('returns correct fraction for 1 of 4 pixels', () => {
    const img = makeImageDataAlpha(2, 2, [128, 0, 0, 0])
    expect(computeSignatureCoverage(img)).toBe(0.25)
  })
})

describe('isSignatureValid (grid fill)', () => {
  it('returns false for blank canvas', () => {
    const img = makeImageDataAlpha(10, 10, new Array(100).fill(0))
    expect(isSignatureValid(img)).toBe(false)
  })

  it('returns true for fully drawn canvas', () => {
    const img = makeImageDataAlpha(10, 10, new Array(100).fill(255))
    expect(isSignatureValid(img)).toBe(true)
  })

  it('returns false when coverage is below threshold (1 of 100 pixels)', () => {
    const alphas = new Array(100).fill(0)
    alphas[0] = 255
    const img = makeImageDataAlpha(10, 10, alphas)
    expect(isSignatureValid(img)).toBe(false)
  })

  it('returns true when coverage meets threshold (2 of 100 pixels)', () => {
    const alphas = new Array(100).fill(0)
    alphas[0] = 255
    alphas[1] = 255
    const img = makeImageDataAlpha(10, 10, alphas)
    expect(isSignatureValid(img)).toBe(true)
  })

  it('uses custom threshold when provided', () => {
    const alphas = new Array(100).fill(0)
    for (let i = 0; i < 50; i++) alphas[i] = 255
    const img = makeImageDataAlpha(10, 10, alphas)
    expect(isSignatureValid(img, 0.6)).toBe(false)
    expect(isSignatureValid(img, 0.5)).toBe(true)
  })
})
