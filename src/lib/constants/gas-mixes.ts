import { GAS_MIXES, type GasMix } from '../../../convex/shared/gasMixes'
export { GAS_MIXES, type GasMix } from '../../../convex/shared/gasMixes'

export const GAS_MIX_LABELS: Record<string, string> = {
  air: 'Air',
  nitrox: 'Nitrox',
}

export const GAS_MIX_OPTIONS: { value: GasMix; label: string }[] =
  GAS_MIXES.map((v) => ({ value: v, label: GAS_MIX_LABELS[v] }))

export const GAS_MIX_COLORS: Record<string, string> = {
  air: 'var(--color-info, var(--color-secondary))',
  nitrox: 'var(--color-success)',
}

export const NITROX_MIN_PERCENT = 22
export const NITROX_MAX_PERCENT = 40
export const NITROX_DEFAULT_MIN = 32
export const NITROX_DEFAULT_MAX = 36
