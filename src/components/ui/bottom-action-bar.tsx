'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface BottomActionBarProps {
  children: ReactNode
  className?: string
}

export function BottomActionBar({ children, className }: BottomActionBarProps) {
  return (
    <div
      className={cn(
        'fixed bottom-0 inset-x-0 z-[var(--z-sticky)] px-3 pt-2 border-t border-glass-border bg-transparent',
        'md:static md:border-t-0 md:p-0',
        'md:flex md:justify-end',
        className,
      )}
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }} /* design-ok */
    >
      <div className="w-full md:w-auto [&>div]:w-full [&>div]:md:w-auto [&_button]:w-full [&_button]:md:w-auto">
        {children}
      </div>
    </div>
  )
}
