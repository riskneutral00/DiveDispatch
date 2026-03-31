import type { ReactNode } from 'react'

interface FormSectionHeaderProps {
  label: ReactNode
  action?: ReactNode
}

export function FormSectionHeader({ label, action }: FormSectionHeaderProps) {
  return action ? (
    <div className="flex items-center justify-between">
      <h2
        className="font-semibold uppercase text-secondary"
        style={{ fontSize: 'var(--font-size-section-header)',
          letterSpacing: '0.08em' }}
      >
        {label}
      </h2>
      {action}
    </div>
  ) : (
    <h2
      className="font-semibold uppercase text-secondary"
      style={{ fontSize: 'var(--font-size-section-header)',
        letterSpacing: '0.08em' }}
    >
      {label}
    </h2>
  )
}
