import type { MutableRefObject } from 'react'

/** Whether two snapshots differ (JSON). */
export function isDirtyComparedToSnapshot<T>(form: T, baseline: T): boolean {
  return JSON.stringify(form) !== JSON.stringify(baseline)
}

/** Whether `form` differs from the ref snapshot (JSON). Used by forms that track baseline in a ref. */
export function isDirtyComparedToBaseline<T>(
  form: T,
  baselineRef: MutableRefObject<T | null>,
): boolean {
  return (
    baselineRef.current !== null &&
    isDirtyComparedToSnapshot(form, baselineRef.current)
  )
}
