export const SIGNATURE_COVERAGE_THRESHOLD = 0.02

export function computeSignatureCoverage(imageData: ImageData): number {
  const { data, width, height } = imageData
  const totalPixels = width * height
  if (totalPixels === 0) return 0

  let filledCount = 0
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) filledCount++
  }

  return filledCount / totalPixels
}

export function isSignatureValid(
  imageData: ImageData,
  threshold: number = SIGNATURE_COVERAGE_THRESHOLD,
): boolean {
  return computeSignatureCoverage(imageData) >= threshold
}
