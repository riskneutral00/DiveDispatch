'use client'

import type { ReactNode } from 'react'
import { PageTitle } from '@/components/ui/page-title'
import { cn } from '@/lib/utils/cn'

const MAX_WIDTH_CLASS = {
  lg: 'max-w-lg',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '7xl': 'max-w-7xl',
} as const

export type DashboardPageMaxWidth = keyof typeof MAX_WIDTH_CLASS

export interface DashboardPageFrameProps {
  children: ReactNode
  maxWidth?: DashboardPageMaxWidth
  padding?: 'none' | 'standard' | 'mobileNavClearance'
  title?: string
  description?: string
  leading?: ReactNode
  className?: string
}

export function DashboardPageFrame({
  children,
  maxWidth = '3xl',
  padding = 'none',
  title,
  description,
  leading,
  className,
}: DashboardPageFrameProps) {
  const pad =
    padding === 'none'
      ? ''
      : padding === 'mobileNavClearance'
        ? 'px-4 pt-6 pb-28 md:pb-10'
        : 'px-4 pt-6'

  return (
    <div
      className={cn(MAX_WIDTH_CLASS[maxWidth], 'mx-auto w-full', pad, className)}
    >
      {(title || description || leading) && (
        <PageTitle leading={leading} title={title ?? ''} description={description} />
      )}
      {children}
    </div>
  )
}
