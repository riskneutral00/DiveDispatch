import type { LucideIcon } from 'lucide-react'
import { Card } from './card'
import { CardTitle } from './card-title'

type ErrorCardSize = 'sm' | 'md'

interface ErrorCardProps {
  icon: LucideIcon
  iconColor?: string
  title: string
  message: string
  action?: React.ReactNode
  size?: ErrorCardSize
}

const sizeMap: Record<ErrorCardSize, string> = {
  sm: 'min-h-[60vh]',
  md: 'min-h-screen',
}

export function ErrorCard({
  icon: Icon,
  iconColor = 'var(--color-destructive)',
  title,
  message,
  action,
  size = 'md',
}: ErrorCardProps) {
  return (
    <div className={`flex items-center justify-center ${sizeMap[size]} px-4`}>
      <Card centered className="max-w-md w-full" padding="lg">
        <div className="mb-4 flex justify-center">
          <Icon size={40} style={{ color: iconColor }} />
        </div>
        <CardTitle className="mb-2">{title}</CardTitle>
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
