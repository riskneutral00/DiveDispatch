import { cn } from '@/lib/utils/cn'

interface CardTitleProps {
  children: React.ReactNode
  as?: 'h2' | 'h3'
  weight?: 'semibold' | 'bold'
  className?: string
}

export function CardTitle({ children, as: Tag = 'h2', weight = 'semibold', className }: CardTitleProps) {
  return (
    <Tag className={cn(
      'text-card-title text-primary font-heading',
      weight === 'bold' ? 'font-bold' : 'font-semibold',
      className,
    )}>
      {children}
    </Tag>
  )
}
