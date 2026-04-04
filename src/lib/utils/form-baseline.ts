/** Whether two snapshots differ (JSON). */
export function isDirtyComparedToSnapshot<T>(form: T, baseline: T): boolean {
  return JSON.stringify(form) !== JSON.stringify(baseline)
}
