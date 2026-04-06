import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface BackgroundLayoutProps {
  children: ReactNode
  className?: string
}

export function BackgroundLayout({ children, className }: BackgroundLayoutProps) {
  return (
    <div className="min-h-screen relative">
      <div className="bg-image" />
      <div className="bg-overlay" />
      <main className={cn('app-shell min-h-screen flex flex-col relative', className)}>
        {children}
      </main>
    </div>
  )
}
