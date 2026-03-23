/**
 * Canonical source of truth for CourseCode.
 * Array, TypeScript type, and Convex validator all derive from a single list.
 * Adding a course code = edit this array, done.
 */
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

// Build validator programmatically from the array.
// Type assertion needed because .map() widens literal types;
// runtime behavior is correct — each v.literal() checks the exact string.
const literals = COURSE_CODES.map((c) => v.literal(c)) as [
  ReturnType<typeof v.literal<(typeof COURSE_CODES)[0]>>,
  ...ReturnType<typeof v.literal<(typeof COURSE_CODES)[number]>>[],
]
export const courseCodeValidator = v.union(...literals)

// ── Compile-time guard ───────────────────────────────────────────────
// Bidirectional check: fails if the validator's inferred type and the
// array's derived type ever diverge. tsc catches drift immediately.
type ValidatorType = Infer<typeof courseCodeValidator>
type _Check = ValidatorType extends CourseCode
  ? CourseCode extends ValidatorType
    ? true
    : never
  : never
const _guard: _Check = true
void _guard
