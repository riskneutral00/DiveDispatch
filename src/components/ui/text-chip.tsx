import { cn } from '@/lib/utils/cn'

export type TextChipTone = 'default' | 'elevated' | 'muted' | 'glass'
export type TextChipShape = 'rounded' | 'pill'

interface TextChipProps {
  children: React.ReactNode
  tone?: TextChipTone
  shape?: TextChipShape
  className?: string
}

const toneClass: Record<TextChipTone, string> = {
  default: 'bg-glass-bg text-primary',
  elevated: 'bg-glass-bg-elevated text-primary',
  muted: 'bg-glass-border text-secondary',
  glass: 'glass-container text-secondary',
}

const shapeClass: Record<TextChipShape, string> = {
  rounded: 'rounded-[var(--border-radius-button)]',
  pill: 'rounded-full',
}

export function TextChip({
  children,
  tone = 'default',
  shape = 'rounded',
  className,
}: TextChipProps) {
  return (
    <span
      className={cn(
        'text-label px-1.5 py-0.5 shrink-0',
        shapeClass[shape],
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
