import { Check } from 'lucide-react'

interface StepIndicatorProps {
  steps: readonly { key: string; label: string }[]
  currentIndex: number
}

export function StepIndicator({ steps, currentIndex }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress" className="flex items-center justify-center gap-0">
      {steps.map((step, i) => {
        const isCompleted = i < currentIndex
        const isActive = i === currentIndex
        const isLast = i === steps.length - 1

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              {/* Step circle */}
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full border text-xs font-semibold transition-all"
                style={{
                  background: isCompleted
                    ? 'var(--color-success)'
                    : isActive
                      ? 'var(--color-glass-bg-elevated)'
                      : 'var(--color-glass-bg)',
                  borderColor: isCompleted || isActive
                    ? 'var(--color-primary)'
                    : 'var(--color-glass-border)',
                  color: isCompleted
                    ? 'var(--color-text-on-primary)'
                    : isActive
                      ? 'var(--color-primary)'
                      : 'var(--color-text-secondary)',
                }}
                aria-current={isActive ? 'step' : undefined}
              >
                {isCompleted ? <Check size={12} strokeWidth={3} /> : i + 1}
              </div>

              {/* Step label */}
              <span
                className="text-xs font-medium whitespace-nowrap"
                style={{
                  color: isActive
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-secondary)',
                }}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className="h-px mx-2 mb-5 transition-all"
                style={{
                  width: steps.length <= 5 ? 48 : 24,
                  background: isCompleted
                    ? 'var(--color-success)'
                    : 'var(--color-glass-border)',
                }}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}
