export type StatusColorSet = {
  textVar: string
  bgVar: string
  borderVar: string
  dotVar: string
}

const VESSEL_PALETTE: StatusColorSet[] = [
  { textVar: '#3b82f6', bgVar: 'rgba(59, 130, 246, 0.12)', borderVar: 'rgba(59, 130, 246, 0.4)', dotVar: '#3b82f6' },
  { textVar: '#10b981', bgVar: 'rgba(16, 185, 129, 0.12)', borderVar: 'rgba(16, 185, 129, 0.4)', dotVar: '#10b981' },
  { textVar: '#f59e0b', bgVar: 'rgba(245, 158, 11, 0.12)', borderVar: 'rgba(245, 158, 11, 0.4)', dotVar: '#f59e0b' },
  { textVar: '#f43f5e', bgVar: 'rgba(244, 63, 94, 0.12)', borderVar: 'rgba(244, 63, 94, 0.4)', dotVar: '#f43f5e' },
  { textVar: '#8b5cf6', bgVar: 'rgba(139, 92, 246, 0.12)', borderVar: 'rgba(139, 92, 246, 0.4)', dotVar: '#8b5cf6' },
  { textVar: '#06b6d4', bgVar: 'rgba(6, 182, 212, 0.12)', borderVar: 'rgba(6, 182, 212, 0.4)', dotVar: '#06b6d4' },
  { textVar: '#f97316', bgVar: 'rgba(249, 115, 22, 0.12)', borderVar: 'rgba(249, 115, 22, 0.4)', dotVar: '#f97316' },
  { textVar: '#14b8a6', bgVar: 'rgba(20, 184, 166, 0.12)', borderVar: 'rgba(20, 184, 166, 0.4)', dotVar: '#14b8a6' },
]

export function getVesselColor(index: number): StatusColorSet {
  return VESSEL_PALETTE[index % VESSEL_PALETTE.length]
}
