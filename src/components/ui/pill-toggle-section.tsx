import { type ReactNode } from 'react'
import { RequiredAsterisk } from '@/components/ui/required-asterisk'
import { cn } from '@/lib/utils/cn'

type PillToggleSectionGap = 'sm' | 'md'

interface PillToggleSectionProps {
  label: string
  required?: boolean
  labelTrailing?: ReactNode
  hideLabel?: boolean
  gap?: PillToggleSectionGap
  children: ReactNode
  className?: string
}

const GAP_CLASS: Record<PillToggleSectionGap, string> = {
  sm: 'gap-1.5',
  md: 'gap-2',
}

export function PillToggleSection({
  label,
  required,
  labelTrailing,
  hideLabel,
  gap = 'sm',
  children,
  className,
}: PillToggleSectionProps) {
  return (
    <fieldset
      className={cn(
        'relative flex flex-col w-full border-0 m-0 min-w-0 reading-plane rounded-theme p-2',
        GAP_CLASS[gap],
        className,
      )}
    >
      <legend
        className={
          hideLabel
            ? 'sr-only'
            : 'text-body font-medium text-secondary w-full px-0 flex items-center gap-2'
        }
      >
        <span>{label}</span>
        {required && !hideLabel && <RequiredAsterisk />}
        {!hideLabel && labelTrailing}
      </legend>
      {children}
    </fieldset>
  )
}
