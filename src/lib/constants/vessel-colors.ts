/**
 * Dynamic color palette for fleet vessel legend pills.
 * Same shape as STATUS_COLORS entries so they plug directly into
 * BookingCalendar's custom category system.
 */

export type StatusColorSet = {
  textVar: string
  bgVar: string
  borderVar: string
  dotVar: string
}

const VESSEL_PALETTE: StatusColorSet[] = [
  // Blue
  { textVar: '#3b82f6', bgVar: 'rgba(59, 130, 246, 0.12)', borderVar: 'rgba(59, 130, 246, 0.4)', dotVar: '#3b82f6' },
  // Emerald
  { textVar: '#10b981', bgVar: 'rgba(16, 185, 129, 0.12)', borderVar: 'rgba(16, 185, 129, 0.4)', dotVar: '#10b981' },
  // Amber
  { textVar: '#f59e0b', bgVar: 'rgba(245, 158, 11, 0.12)', borderVar: 'rgba(245, 158, 11, 0.4)', dotVar: '#f59e0b' },
  // Rose
  { textVar: '#f43f5e', bgVar: 'rgba(244, 63, 94, 0.12)', borderVar: 'rgba(244, 63, 94, 0.4)', dotVar: '#f43f5e' },
  // Violet
  { textVar: '#8b5cf6', bgVar: 'rgba(139, 92, 246, 0.12)', borderVar: 'rgba(139, 92, 246, 0.4)', dotVar: '#8b5cf6' },
  // Cyan
  { textVar: '#06b6d4', bgVar: 'rgba(6, 182, 212, 0.12)', borderVar: 'rgba(6, 182, 212, 0.4)', dotVar: '#06b6d4' },
  // Orange
  { textVar: '#f97316', bgVar: 'rgba(249, 115, 22, 0.12)', borderVar: 'rgba(249, 115, 22, 0.4)', dotVar: '#f97316' },
  // Teal
  { textVar: '#14b8a6', bgVar: 'rgba(20, 184, 166, 0.12)', borderVar: 'rgba(20, 184, 166, 0.4)', dotVar: '#14b8a6' },
]

export function getVesselColor(index: number): StatusColorSet {
  return VESSEL_PALETTE[index % VESSEL_PALETTE.length]
}
