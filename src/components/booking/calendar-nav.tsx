'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton } from '@/components/ui/icon-button'
import { Button } from '@/components/ui/button'

interface CalendarNavProps {
  label: string
  onPrev: () => void
  onNext: () => void
  prevLabel: string
  nextLabel: string
  onLabelClick?: () => void
}

export function CalendarNav({
  label,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  onLabelClick,
}: CalendarNavProps) {
  return (
    <div className="glass-container glass-surface transition rounded-theme inline-flex items-center gap-3 px-3 py-1">
      <IconButton variant="ghost" onClick={onPrev} aria-label={prevLabel}>
        <ChevronLeft size={16} />
      </IconButton>
      {onLabelClick ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onLabelClick}
          className="font-semibold text-card-title min-w-[12rem] text-center hover:underline underline-offset-4 text-primary font-heading"
        >
          {label}
        </Button>
      ) : (
        <span className="font-semibold text-card-title min-w-[12rem] text-center text-primary font-heading">
          {label}
        </span>
      )}
      <IconButton variant="ghost" onClick={onNext} aria-label={nextLabel}>
        <ChevronRight size={16} />
      </IconButton>
    </div>
  )
}
