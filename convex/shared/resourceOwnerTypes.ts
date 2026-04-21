import { v, type Infer } from 'convex/values'

export const RESOURCE_OWNER_TYPES = [
  'Boat',
  'Equipment',
  'Venue',
  'Compressor',
  'Instructor',
  'Liveaboard',
] as const

export type ResourceOwnerType = (typeof RESOURCE_OWNER_TYPES)[number]

const literals = RESOURCE_OWNER_TYPES.map((c) => v.literal(c)) as [
  ReturnType<typeof v.literal<(typeof RESOURCE_OWNER_TYPES)[0]>>,
  ...ReturnType<typeof v.literal<(typeof RESOURCE_OWNER_TYPES)[number]>>[],
]
export const resourceOwnerTypeValidator = v.union(...literals)

type ValidatorType = Infer<typeof resourceOwnerTypeValidator>
type _Check = ValidatorType extends ResourceOwnerType
  ? ResourceOwnerType extends ValidatorType
    ? true
    : never
  : never
const _guard: _Check = true
void _guard
