import type { ReactNode } from 'react'

interface PageTitleProps {
  title: string
  description?: string
  leading?: ReactNode
  className?: string
}

export function PageTitle({ title, description, leading, className }: PageTitleProps) {
  const heading = (
    <h1
      className={`font-bold text-primary font-heading text-page-title ${leading == null ? 'mb-1' : ''}`}
    >
      {title}
    </h1>
  )

  return (
    <div className={className ?? 'mb-6'}>
      {leading != null ? (
        <div className="flex items-center gap-3 mb-1">
          {leading}
          {heading}
        </div>
      ) : (
        heading
      )}
      {description != null && description !== '' && (
        <p className={`text-body text-secondary ${leading != null ? 'mt-2' : ''}`}>{description}</p>
      )}
    </div>
  )
}
