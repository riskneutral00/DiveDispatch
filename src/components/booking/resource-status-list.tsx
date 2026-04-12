'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorAlert } from '@/components/ui/error-alert'
import { ListRow } from '@/components/ui/list-row'

export interface ResourceStatusItem {
  id: string
  primaryText: string
  secondaryText?: string
  tertiaryText?: string
  badge?: { variant: BadgeVariant; label: string; dot?: boolean }
  actions?: ReactNode
  destructiveNote?: string
}

interface ResourceStatusListProps {
  items: ResourceStatusItem[]
  emptyMessageKey: string
  namespace: string
  emptyIcon?: LucideIcon
  variant?: 'list' | 'card'
  dedupeBy?: (item: ResourceStatusItem) => string
  globalError?: string | null
}

export function ResourceStatusList({
  items,
  emptyMessageKey,
  namespace,
  emptyIcon,
  variant = 'list',
  dedupeBy,
  globalError,
}: ResourceStatusListProps) {
  const t = useTranslations(namespace)

  if (items.length === 0) {
    return <EmptyState icon={emptyIcon} message={t(emptyMessageKey)} />
  }

  const unique = dedupeBy
    ? items.filter(
        ((seen: Set<string>) => (item: ResourceStatusItem) => {
          const key = dedupeBy(item)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })(new Set<string>()),
      )
    : items

  if (variant === 'card') {
    return (
      <div className="space-y-2">
        {globalError && <ErrorAlert size="sm">{globalError}</ErrorAlert>}
        {unique.map((item) => (
          <Card key={item.id} padding="sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <ResourceBody item={item} inlineBadge />
              {item.actions && (
                <div className="flex gap-2 flex-shrink-0">{item.actions}</div>
              )}
            </div>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <>
      {globalError && (
        <div className="mb-2">
          <ErrorAlert size="sm">{globalError}</ErrorAlert>
        </div>
      )}
      <ul className="space-y-2">
        {unique.map((item) => (
          <ListRow key={item.id} as="li">
            <ResourceBody item={item} />
            {item.badge && (
              <Badge variant={item.badge.variant} size="sm" dot={item.badge.dot}>
                {item.badge.label}
              </Badge>
            )}
            {item.actions && (
              <div className="flex gap-2 flex-shrink-0">{item.actions}</div>
            )}
          </ListRow>
        ))}
      </ul>
    </>
  )
}

function ResourceBody({
  item,
  inlineBadge = false,
}: {
  item: ResourceStatusItem
  inlineBadge?: boolean
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-body font-medium truncate text-primary">
          {item.primaryText}
        </p>
        {inlineBadge && item.badge && (
          <Badge variant={item.badge.variant} size="sm" dot={item.badge.dot}>
            {item.badge.label}
          </Badge>
        )}
      </div>
      {item.secondaryText && (
        <p className="text-label mt-0.5 text-secondary">{item.secondaryText}</p>
      )}
      {item.tertiaryText && (
        <p className="text-label mt-0.5 text-secondary">{item.tertiaryText}</p>
      )}
      {item.destructiveNote && (
        <p className="text-label mt-0.5 text-destructive">
          {item.destructiveNote}
        </p>
      )}
    </div>
  )
}
