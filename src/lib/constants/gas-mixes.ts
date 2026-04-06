import { GAS_MIXES } from '../../../convex/shared/gasMixes'
export { GAS_MIXES, type GasMix } from '../../../convex/shared/gasMixes'

export const GAS_MIX_LABELS: Record<string, string> = {
  air: 'Air',
  nitrox: 'Nitrox',
  trimix: 'Trimix',
}

export const GAS_MIX_OPTIONS: { value: GasMix; label: string }[] =
  GAS_MIXES.map((v) => ({ value: v, label: GAS_MIX_LABELS[v] }))

export const GAS_MIX_COLORS: Record<string, string> = {
  air: 'var(--color-info, var(--color-secondary))',
  nitrox: 'var(--color-success)',
  trimix: 'var(--color-warning)',
}
