'use client'

import React from 'react'

interface CalendarGridProps {
  year: number
  month: number // 0-indexed (0 = January)
  renderDay: (date: Date, isCurrentMonth: boolean) => React.ReactNode
  className?: string
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarGrid({ year, month, renderDay, className = '' }: CalendarGridProps) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay() // day of week for first of month

  const days: { date: Date; isCurrentMonth: boolean }[] = []

  // Pad start with days from previous month
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    days.push({ date: d, isCurrentMonth: false })
  }

  // Days in current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true })
  }

  // Pad end to complete last row
  const remaining = 7 - (days.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      days.push({ date: new Date(year, month + 1, d), isCurrentMonth: false })
    }
  }

  return (
    <div className={className}>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="text-center text-xs font-semibold py-1 text-secondary"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ date, isCurrentMonth }, i) => (
          <div key={i} style={{ opacity: isCurrentMonth ? 1 : 0.35 }}>
            {renderDay(date, isCurrentMonth)}
          </div>
        ))}
      </div>
    </div>
  )
}
