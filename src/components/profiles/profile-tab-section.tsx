import type { ReactNode } from 'react'

/** Tabbed profile pages: render children only when no tab is active or the active tab matches `id`. */
export function ProfileTabSection({
  id,
  section,
  children,
}: {
  id: string
  section: string | undefined
  children: ReactNode
}) {
  if (section && section !== id) return null
  return <>{children}</>
}
