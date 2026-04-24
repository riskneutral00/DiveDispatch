import { cn } from '@/lib/utils/cn'

interface CardTitleProps {
  children: React.ReactNode
  as?: 'h2' | 'h3'
  weight?: 'semibold' | 'bold'
  size?: 'md' | 'sm'
  className?: string
}

const sizeMap = {
  md: 'text-card-title',
  sm: 'text-body',
} as const

export function CardTitle({ children, as: Tag = 'h2', weight = 'semibold', size = 'md', className }: CardTitleProps) {
  return (
    <Tag className={cn(
      sizeMap[size],
      'text-primary font-heading',
      weight === 'bold' ? 'font-bold' : 'font-semibold',
      className,
    )}>
      {children}
    </Tag>
  )
}
