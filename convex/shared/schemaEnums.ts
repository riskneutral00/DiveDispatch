/** Small schema enums grouped in one file. */
import { v, type Infer } from 'convex/values'

// ── CapacityModel ────────────────────────────────────────────────────

export const CAPACITY_MODELS = ['Exclusive', 'Pooled'] as const
export type CapacityModel = (typeof CAPACITY_MODELS)[number]
export const capacityModelValidator = v.union(
  v.literal('Exclusive'),
  v.literal('Pooled'),
)

// ── Gender ───────────────────────────────────────────────────────────

export const GENDERS = ['M', 'F', 'Other'] as const
export type Gender = (typeof GENDERS)[number]
export const genderValidator = v.union(
  v.literal('M'),
  v.literal('F'),
  v.literal('Other'),
)

// ── ShoeSizeUnit ─────────────────────────────────────────────────────

export const SHOE_SIZE_UNITS = ['EU', 'US', 'CM'] as const
export type ShoeSizeUnit = (typeof SHOE_SIZE_UNITS)[number]
export const shoeSizeUnitValidator = v.union(
  v.literal('EU'),
  v.literal('US'),
  v.literal('CM'),
)

// ── AcceptanceMode ───────────────────────────────────────────────────
// PrePayRequired and PostPayAllowed behave identically to Auto until Stripe integration.

export const ACCEPTANCE_MODES = ['Auto', 'PrePayRequired', 'PostPayAllowed'] as const
export type AcceptanceMode = (typeof ACCEPTANCE_MODES)[number]
export const acceptanceModeValidator = v.union(
  v.literal('Auto'),
  v.literal('PrePayRequired'),
  v.literal('PostPayAllowed'),
)

// ── Compile-time guards ──────────────────────────────────────────────

type _CM = Infer<typeof capacityModelValidator> extends CapacityModel
  ? CapacityModel extends Infer<typeof capacityModelValidator> ? true : never : never
type _G = Infer<typeof genderValidator> extends Gender
  ? Gender extends Infer<typeof genderValidator> ? true : never : never
type _SS = Infer<typeof shoeSizeUnitValidator> extends ShoeSizeUnit
  ? ShoeSizeUnit extends Infer<typeof shoeSizeUnitValidator> ? true : never : never
type _AM = Infer<typeof acceptanceModeValidator> extends AcceptanceMode
  ? AcceptanceMode extends Infer<typeof acceptanceModeValidator> ? true : never : never
const _guards: [_CM, _G, _SS, _AM] = [true, true, true, true]
void _guards
