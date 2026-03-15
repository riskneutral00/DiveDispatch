import type { CalendarDisplayStatus } from '@/lib/constants/status-colors'

export interface BookingSpan {
  id: string
  startCol: number
  endCol: number
  label: string
  status: CalendarDisplayStatus
}

export interface PackedBooking extends BookingSpan {
  row: number
}

export function skylinePack(bookings: BookingSpan[]): PackedBooking[] {
  const sorted = [...bookings].sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol
    return b.endCol - b.startCol - (a.endCol - a.startCol)
  })

  const skyline = new Array(7).fill(0)
  const result: PackedBooking[] = []

  for (const booking of sorted) {
    let maxRow = 0
    for (let col = booking.startCol; col <= booking.endCol; col++) {
      maxRow = Math.max(maxRow, skyline[col])
    }

    result.push({ ...booking, row: maxRow })

    for (let col = booking.startCol; col <= booking.endCol; col++) {
      skyline[col] = maxRow + 1
    }
  }

  return result
}

export function getMaxRows(packed: PackedBooking[]): number {
  if (packed.length === 0) return 0
  return Math.max(...packed.map((b) => b.row)) + 1
}
