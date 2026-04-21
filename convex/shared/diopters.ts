export const DIOPTER_MIN = -6.0
export const DIOPTER_MAX = -1.0
export const DIOPTER_STEP = 0.5

function buildDiopterValues(): readonly number[] {
  const out: number[] = []
  const totalSteps = Math.round((DIOPTER_MAX - DIOPTER_MIN) / DIOPTER_STEP)
  for (let i = 0; i <= totalSteps; i++) {
    out.push(Number((DIOPTER_MIN + i * DIOPTER_STEP).toFixed(1)))
  }
  return out
}

export const DIOPTER_VALUES: readonly number[] = buildDiopterValues()

export const PLANO_KEY = 'plano' as const

export function diopterCellKey(d: number): string {
  return d.toFixed(1)
}

export function diopterFromCellKey(key: string): number | null {
  if (key === PLANO_KEY) return null
  const n = Number(key)
  if (!Number.isFinite(n)) return null
  return n
}
