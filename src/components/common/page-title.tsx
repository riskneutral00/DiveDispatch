import type { ReactNode } from 'react'

interface PageTitleProps {
  title: string
  description?: string
  /** Optional icon or badge before the title (e.g. Help page). */
  leading?: ReactNode
  className?: string
}

/** Shared page heading styles for dashboard and global `(dashboard)` routes. */
export function PageTitle({ title, description, leading, className }: PageTitleProps) {
  const heading = (
    <h1
      className={`font-bold text-primary ${leading == null ? 'mb-1' : ''}`}
      style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--font-size-page-title)' }}
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
        <p className={`text-sm text-secondary ${leading != null ? 'mt-2' : ''}`}>{description}</p>
      )}
    </div>
  )
}
