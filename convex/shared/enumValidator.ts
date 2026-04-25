import { v, type Infer } from 'convex/values'

export function defineLiteralUnion<const T extends readonly [string, ...string[]]>(values: T) {
  const literals = values.map((c) => v.literal(c)) as [
    ReturnType<typeof v.literal<T[0]>>,
    ...ReturnType<typeof v.literal<T[number]>>[],
  ]
  const validator = v.union(...literals)
  type Value = T[number]
  type ValidatorValue = Infer<typeof validator>
  type _Check = ValidatorValue extends Value
    ? Value extends ValidatorValue
      ? true
      : never
    : never
  const _guard: _Check = true
  void _guard
  return { values, validator }
}
