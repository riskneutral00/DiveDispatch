/**
 * Signature coverage validation.
 *
 * Checks what percentage of a canvas has non-transparent pixels.
 * Used to prevent single-tap or tiny accidental marks from counting
 * as a valid waiver signature.
 */

/** Minimum fraction of canvas pixels that must be drawn (2%). */
export const SIGNATURE_COVERAGE_THRESHOLD = 0.02

/**
 * Compute the fraction of non-transparent pixels in the given ImageData.
 * A pixel is considered "drawn" if its alpha channel is > 0.
 *
 * @returns A number between 0 (blank) and 1 (fully filled).
 */
export function computeSignatureCoverage(imageData: ImageData): number {
  const { data, width, height } = imageData
  const totalPixels = width * height
  if (totalPixels === 0) return 0

  let filledCount = 0
  // Alpha is every 4th byte starting at offset 3
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) filledCount++
  }

  return filledCount / totalPixels
}

/**
 * Returns true if the signature meets the minimum coverage threshold.
 *
 * @param imageData - Canvas pixel data from `ctx.getImageData()`.
 * @param threshold - Minimum coverage ratio (default: SIGNATURE_COVERAGE_THRESHOLD).
 */
export function isSignatureValid(
  imageData: ImageData,
  threshold: number = SIGNATURE_COVERAGE_THRESHOLD,
): boolean {
  return computeSignatureCoverage(imageData) >= threshold
}
