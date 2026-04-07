import type { LucideIcon } from 'lucide-react'
import { Card } from './card'

interface ErrorCardProps {
  icon: LucideIcon
  iconColor?: string
  title: string
  message: string
  action?: React.ReactNode
  minHeight?: string
}

export function ErrorCard({
  icon: Icon,
  iconColor = 'var(--color-destructive)',
  title,
  message,
  action,
  minHeight = 'min-h-screen',
}: ErrorCardProps) {
  return (
    <div className={`flex items-center justify-center ${minHeight} px-4`}>
      <Card centered className="max-w-md w-full" padding="lg">
        <div className="mb-4 flex justify-center">
          <Icon size={40} style={{ color: iconColor }} />
        </div>
        <h2
          className="text-card-title font-semibold mb-2 text-primary font-heading"
        >
          {title}
        </h2>
        <p
          className="text-body leading-relaxed text-secondary"
        >
          {message}
        </p>
        {action && <div className="mt-6">{action}</div>}
      </Card>
    </div>
  )
}
