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
        'fixed bottom-[60px] inset-x-0 z-[var(--z-sticky)] p-3 border-t border-glass-border bg-transparent',
        'md:static md:border-t-0 md:p-0',
        'md:flex md:justify-end',
        className,
      )}
    >
      <div className="w-full md:w-auto [&>div]:w-full [&>div]:md:w-auto [&_button]:w-full [&_button]:md:w-auto">
        {children}
      </div>
    </div>
  )
}
