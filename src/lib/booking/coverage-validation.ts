/**
 * Re-export from convex/shared/coverageValidation.
 * Single source of truth lives in convex/shared/ to satisfy the dependency
 * direction rule (convex/ <- lib/ <- components/ <- app/).
 * This file exists so client-side consumers can import from their usual path.
 */
export {
  checkPreferenceCoverage,
  type VenueCapabilities,
  type BoatCapabilities,
  type CoverageInput,
  type CoverageResult,
} from '../../../convex/shared/coverageValidation'
