/** Canonical source of truth for GasMix. */
import { v, type Infer } from 'convex/values'

export const GAS_MIXES = ['air', 'nitrox', 'trimix'] as const

export type GasMix = (typeof GAS_MIXES)[number]

const literals = GAS_MIXES.map((c) => v.literal(c)) as [
  ReturnType<typeof v.literal<(typeof GAS_MIXES)[0]>>,
  ...ReturnType<typeof v.literal<(typeof GAS_MIXES)[number]>>[],
]
export const gasMixValidator = v.union(...literals)

// ── Compile-time guard ───────────────────────────────────────────────
type ValidatorType = Infer<typeof gasMixValidator>
type _Check = ValidatorType extends GasMix
  ? GasMix extends ValidatorType
    ? true
    : never
  : never
const _guard: _Check = true
void _guard
