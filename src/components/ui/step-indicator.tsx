import { Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type StepSize = 'sm' | 'md'

interface StepIndicatorProps {
  steps: readonly { key: string; label: string }[]
  currentIndex: number
  size?: StepSize
  hideLabelsOnMobile?: boolean
  variant?: 'subtle' | 'filled'
  connectorMode?: 'fixed' | 'flex'
}

const circleSize: Record<StepSize, string> = {
  sm: 'w-7 h-7 border text-label',
  md: 'w-8 h-8 border-2 text-body',
}

const checkSize: Record<StepSize, number> = { sm: 12, md: 14 }

function stepColors(
  isCompleted: boolean,
  isActive: boolean,
  variant: 'subtle' | 'filled',
): React.CSSProperties {
  return {
    background: isCompleted
      ? 'var(--color-success)'
      : isActive
        ? variant === 'filled'
          ? 'var(--color-primary)'
          : 'var(--color-glass-bg-elevated)'
        : 'var(--color-glass-bg)',
    borderColor: isCompleted
      ? variant === 'filled' ? 'var(--color-success)' : 'var(--color-primary)'
      : isActive
        ? 'var(--color-primary)'
        : 'var(--color-glass-border)',
    color: isCompleted
      ? 'var(--color-text-on-primary)'
      : isActive
        ? variant === 'filled'
          ? 'var(--color-text-on-primary)'
          : 'var(--color-primary)'
        : 'var(--color-text-secondary)',
  }
}

export function StepIndicator({
  steps,
  currentIndex,
  size = 'sm',
  hideLabelsOnMobile = false,
  variant = 'subtle',
  connectorMode = 'fixed',
}: StepIndicatorProps) {
  const Tag = connectorMode === 'flex' ? 'ol' : 'div'
  const ItemTag = connectorMode === 'flex' ? 'li' : 'div'

  return (
    <nav aria-label="Progress">
      <Tag className={cn('flex items-center', connectorMode === 'fixed' && 'justify-center gap-0', connectorMode === 'flex' && 'w-full')}>
        {steps.map((step, i) => {
          const isCompleted = i < currentIndex
          const isActive = i === currentIndex
          const isLast = i === steps.length - 1

          return (
            <ItemTag
              key={step.key}
              className={cn('flex items-center', connectorMode === 'flex' && !isLast && 'flex-1')}
            >
              <div className="flex flex-col items-center gap-1.5 relative">
                <div
                  className={cn(
                    'flex items-center justify-center rounded-full font-semibold transition-all duration-theme shrink-0',
                    circleSize[size],
                  )}
                  style={stepColors(isCompleted, isActive, variant)}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isCompleted ? <Check size={checkSize[size]} strokeWidth={3} /> : i + 1}
                </div>

                <span
                  className={cn(
                    'text-label font-medium whitespace-nowrap',
                    hideLabelsOnMobile && 'hidden sm:block',
                  )}
                  style={{
                    color: isActive
                      ? 'var(--color-text-primary)'
                      : 'var(--color-text-secondary)',
                  }}
                >
                  {step.label}
                </span>
              </div>

              {!isLast && (
                <div
                  className={cn(
                    'h-px mx-2 rounded-full transition-all duration-theme',
                    hideLabelsOnMobile ? 'mb-5 sm:mb-6' : 'mb-5',
                    connectorMode === 'flex' && 'flex-1 h-0.5',
                  )}
                  style={{
                    ...(connectorMode === 'fixed' && { width: steps.length <= 5 ? 48 : 24 }),
                    background: isCompleted
                      ? 'var(--color-success)'
                      : 'var(--color-glass-border)',
                  }}
                />
              )}
            </ItemTag>
          )
        })}
      </Tag>
    </nav>
  )
}
