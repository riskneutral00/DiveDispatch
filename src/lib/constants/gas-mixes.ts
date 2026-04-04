export const GAS_MIXES = ['air', 'nitrox', 'trimix'] as const
export type GasMix = (typeof GAS_MIXES)[number]

export const GAS_MIX_LABELS: Record<GasMix, string> = {
  air: 'Air',
  nitrox: 'Nitrox',
  trimix: 'Trimix',
}

export const GAS_MIX_OPTIONS: { value: GasMix; label: string }[] =
  GAS_MIXES.map((v) => ({ value: v, label: GAS_MIX_LABELS[v] }))

export const GAS_MIX_COLORS: Record<GasMix, string> = {
  air: 'var(--color-info, var(--color-secondary))',
  nitrox: 'var(--color-success)',
  trimix: 'var(--color-warning)',
}
