import { cn } from '@/lib/utils/cn'

export function Skeleton({ className, shape = 'rect' }: { className?: string; shape?: 'rect' | 'circle' }) {
  return (
    <div
      className={cn('animate-pulse bg-glass-border', shape === 'circle' ? 'rounded-full' : 'rounded', className)}
    />
  )
}
