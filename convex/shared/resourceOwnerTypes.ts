/**
 * Canonical source of truth for ResourceOwnerType.
 * Array, TypeScript type, and Convex validator all derive from a single list.
 * Adding a resource owner type = edit this array, done.
 */
import { v, type Infer } from 'convex/values'

export const RESOURCE_OWNER_TYPES = [
  'Boat',
  'Equipment',
  'Pool',
  'Compressor',
  'Instructor',
  'Liveaboard',
  'DiveSite',
] as const

export type ResourceOwnerType = (typeof RESOURCE_OWNER_TYPES)[number]

const literals = RESOURCE_OWNER_TYPES.map((c) => v.literal(c)) as [
  ReturnType<typeof v.literal<(typeof RESOURCE_OWNER_TYPES)[0]>>,
  ...ReturnType<typeof v.literal<(typeof RESOURCE_OWNER_TYPES)[number]>>[],
]
export const resourceOwnerTypeValidator = v.union(...literals)

// ── Compile-time guard ───────────────────────────────────────────────
type ValidatorType = Infer<typeof resourceOwnerTypeValidator>
type _Check = ValidatorType extends ResourceOwnerType
  ? ResourceOwnerType extends ValidatorType
    ? true
    : never
  : never
const _guard: _Check = true
void _guard
