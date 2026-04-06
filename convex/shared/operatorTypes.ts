/**
 * Canonical source of truth for OperatorType.
 * Array, TypeScript type, and Convex validator all derive from a single list.
 * Adding an operator type = edit this array, done.
 */
import { v, type Infer } from 'convex/values'

export const OPERATOR_TYPES = [
  'DiveCenter',
  'Agent',
  'Liveaboard',
  'DiveResort',
  'DiveHostel',
  'DiveSite',
] as const

export type OperatorType = (typeof OPERATOR_TYPES)[number]

const literals = OPERATOR_TYPES.map((c) => v.literal(c)) as [
  ReturnType<typeof v.literal<(typeof OPERATOR_TYPES)[0]>>,
  ...ReturnType<typeof v.literal<(typeof OPERATOR_TYPES)[number]>>[],
]
export const operatorTypeValidator = v.union(...literals)

// ── Compile-time guard ───────────────────────────────────────────────
type ValidatorType = Infer<typeof operatorTypeValidator>
type _Check = ValidatorType extends OperatorType
  ? OperatorType extends ValidatorType
    ? true
    : never
  : never
const _guard: _Check = true
void _guard
