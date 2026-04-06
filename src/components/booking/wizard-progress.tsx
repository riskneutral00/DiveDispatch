import { Check } from 'lucide-react'
import { WIZARD_STEPS, WIZARD_STEP_LABELS, stepIndex, type WizardStep } from '@/lib/booking/wizard-state'
import { cn } from '@/lib/utils/cn'

interface WizardProgressProps {
  currentStep: WizardStep
}

export function WizardProgress({ currentStep }: WizardProgressProps) {
  const current = stepIndex(currentStep)

  return (
    <nav aria-label="Booking wizard progress">
      <ol className="flex items-center w-full">
        {WIZARD_STEPS.map((step, index) => {
          const isCompleted = index < current
          const isActive = index === current
          const isLast = index === WIZARD_STEPS.length - 1

          return (
            <li
              key={step}
              className={cn('flex items-center', !isLast && 'flex-1')}
            >
              {/* Step node */}
              <div className="flex flex-col items-center gap-1.5 relative">
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full',
                    'border-2 text-sm font-semibold transition-all',
                    'shrink-0',
                  )}
                  style={{
                    background: isCompleted
                      ? 'var(--color-success)'
                      : isActive
                        ? 'var(--color-primary)'
                        : 'var(--color-glass-bg)',
                    borderColor: isCompleted
                      ? 'var(--color-success)'
                      : isActive
                        ? 'var(--color-primary)'
                        : 'var(--color-glass-border)',
                    color: isCompleted || isActive
                      ? 'var(--color-text-on-primary)'
                      : 'var(--color-text-secondary)',
                  }}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <Check size={14} strokeWidth={3} />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                <span
                  className="text-xs font-medium hidden sm:block whitespace-nowrap"
                  style={{
                    color: isActive
                      ? 'var(--color-text-primary)'
                      : 'var(--color-text-secondary)',
                  }}
                >
                  {WIZARD_STEP_LABELS[step]}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className="flex-1 h-0.5 mx-2 mb-5 sm:mb-6 rounded-full transition-all"
                  style={{
                    background: isCompleted
                      ? 'var(--color-success)'
                      : 'var(--color-glass-border)',
                  }}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
