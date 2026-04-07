import { v, type Infer } from 'convex/values'

export const COURSE_CODES = [
  'DSD',
  'TRY_DIVE',
  'OW',
  'AOW',
  'RESCUE',
  'DM',
  'FD',
  'REFRESH',
  'SPECIALTY',
] as const

export type CourseCode = (typeof COURSE_CODES)[number]

const literals = COURSE_CODES.map((c) => v.literal(c)) as [
  ReturnType<typeof v.literal<(typeof COURSE_CODES)[0]>>,
  ...ReturnType<typeof v.literal<(typeof COURSE_CODES)[number]>>[],
]
export const courseCodeValidator = v.union(...literals)

type ValidatorType = Infer<typeof courseCodeValidator>
type _Check = ValidatorType extends CourseCode
  ? CourseCode extends ValidatorType
    ? true
    : never
  : never
const _guard: _Check = true
void _guard
