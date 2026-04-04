/**
 * Centered error/status card with icon, title, message, and optional action.
 * Used by error.tsx boundaries and expired/closed portal pages.
 *
 * Extracted by L8-27 from 3 inline copies across portal error, dashboard error,
 * and portal expired pages.
 */

import type { LucideIcon } from 'lucide-react'
import { Card } from './card'

interface ErrorCardProps {
  icon: LucideIcon
  iconColor?: string
  title: string
  message: string
  action?: React.ReactNode
  /** Container min-height. Defaults to 'min-h-screen'. Dashboard uses 'min-h-[60vh]'. */
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
      <Card className="max-w-md w-full text-center" padding="lg">
        <div className="mb-4 flex justify-center">
          <Icon size={40} style={{ color: iconColor }} />
        </div>
        <h2
          className="text-lg font-semibold mb-2 text-primary"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {title}
        </h2>
        <p
          className="text-sm leading-relaxed text-secondary"
        >
          {message}
        </p>
        {action && <div className="mt-6">{action}</div>}
      </Card>
    </div>
  )
}
