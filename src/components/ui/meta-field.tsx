import { cn } from '@/lib/utils/cn'

interface MetaFieldProps {
  label: string
  children: React.ReactNode
  className?: string
}

export function MetaField({ label, children, className }: MetaFieldProps) {
  return (
    <div className={cn(className)}>
      <p className="text-label font-semibold uppercase text-secondary">{label}</p>
      <p className="text-primary">{children}</p>
    </div>
  )
}
