import { useState, useCallback } from 'react'
import { Plus, ChevronDown, ChevronRight, Trash2, Save, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { IconButton } from '@/components/ui/icon-button'
import { InlineError } from '@/components/ui/inline-error'
import { cn } from '@/lib/utils/cn'
import type {
  ItemKey,
  RemoveAriaLabel,
  RenderCardTitle,
  RenderExpandedBody,
} from './types'

interface ExpandingCardListProps<T> {
  label: string
  addLabel: string
  items: T[]
  onChange?: (next: T[]) => void
  emptyItem?: () => T
  renderCardTitle: RenderCardTitle<T>
  renderExpandedBody: RenderExpandedBody<T>
  itemKey: ItemKey<T>
  emptyMessage?: string
  minItems?: number
  maxItems?: number
  required?: boolean
  removeAriaLabel?: RemoveAriaLabel<T>
  className?: string
  hideEmptyState?: boolean
  defaultExpandFirst?: boolean
  expandedKeys?: Set<string>
  onExpandedKeysChange?: (next: Set<string>) => void
  onAdd?: () => void
  onRemove?: (item: T, index: number) => void
  onSave?: (item: T, index: number) => void
  savingKeys?: Set<string>
  savedKeys?: Set<string>
  saveErrors?: Record<string, string>
  removeErrors?: Record<string, string>
}

export function ExpandingCardList<T>({
  label,
  addLabel,
  items,
  onChange,
  emptyItem,
  renderCardTitle,
  renderExpandedBody,
  itemKey,
  emptyMessage,
  minItems = 0,
  maxItems,
  required,
  removeAriaLabel,
  className,
  hideEmptyState = false,
  defaultExpandFirst = false,
  expandedKeys: controlledKeys,
  onExpandedKeysChange,
  onAdd,
  onRemove,
  onSave,
  savingKeys,
  savedKeys,
  saveErrors,
  removeErrors,
}: ExpandingCardListProps<T>) {
  const [internalKeys, setInternalKeys] = useState<Set<string>>(() => {
    if (defaultExpandFirst && items.length > 0) {
      return new Set([itemKey(items[0], 0)])
    }
    return new Set()
  })

  const isControlled = controlledKeys !== undefined
  const expandedKeys = isControlled ? controlledKeys : internalKeys

  const setExpandedKeys = useCallback(
    (updater: (prev: Set<string>) => Set<string>) => {
      const prev = isControlled ? controlledKeys : internalKeys
      const next = updater(prev)
      onExpandedKeysChange?.(next)
      if (!isControlled) setInternalKeys(next)
    },
    [isControlled, controlledKeys, internalKeys, onExpandedKeysChange],
  )

  const toggleExpand = useCallback(
    (key: string) => {
      setExpandedKeys((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
    },
    [setExpandedKeys],
  )

  const canAdd = maxItems === undefined || items.length < maxItems
  const canRemoveAt = items.length > minItems

  const handleAdd = () => {
    if (onAdd) return onAdd()
    if (onChange && emptyItem) {
      const next = [...items, emptyItem()]
      onChange(next)
      const newKey = itemKey(next[next.length - 1], next.length - 1)
      setExpandedKeys((prev) => new Set(prev).add(newKey))
    }
  }
  const handleRemove = (index: number, item: T) => {
    if (onRemove) return onRemove(item, index)
    if (onChange) onChange(items.filter((_, i) => i !== index))
  }
  const handleUpdate = (index: number, next: T) => {
    if (onChange) onChange(items.map((item, i) => (i === index ? next : item)))
  }

  return (
    <div className={className}>
      <FormSectionHeader
        label={label}
        required={required}
        action={
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleAdd}
            disabled={!canAdd}
          >
            <Plus size={14} />
            {addLabel}
          </Button>
        }
      />
      <div className="mt-3">
        {items.length === 0 ? (
          hideEmptyState ? null : (
            <EmptyState
              message={emptyMessage ?? 'No items yet'}
              className="glass-container rounded-theme"
            />
          )
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              const key = itemKey(item, index)
              const expanded = expandedKeys.has(key)
              const saving = savingKeys?.has(key) ?? false
              const saved = savedKeys?.has(key) ?? false
              const saveError = saveErrors?.[key]
              const removeError = removeErrors?.[key]

              return (
                <div
                  key={key}
                  className="glass-container reading-plane rounded-theme"
                >
                  <div className="flex items-center gap-2 p-3">
                    <button /* design-ok: card-header expand toggle, distinct from Button primitive */
                      type="button"
                      onClick={() => toggleExpand(key)}
                      aria-expanded={expanded}
                      aria-label={expanded ? 'Collapse' : 'Expand'}
                      className="flex flex-1 min-w-0 items-center gap-2 text-left"
                    >
                      {expanded ? (
                        <ChevronDown size={16} className="text-secondary shrink-0" />
                      ) : (
                        <ChevronRight size={16} className="text-secondary shrink-0" />
                      )}
                      <div className="flex-1 min-w-0 text-body text-primary truncate">
                        {renderCardTitle(item, index)}
                      </div>
                    </button>
                    {onSave && (
                      <IconButton
                        onClick={() => onSave(item, index)}
                        variant="ghost"
                        aria-label="Save item"
                        disabled={saving}
                        className="shrink-0"
                        style={
                          saved
                            ? {
                                background: 'var(--color-active-fg)',
                                borderColor: 'var(--color-active-fg)',
                              }
                            : undefined
                        }
                      >
                        {saving ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : saved ? (
                          <Check size={14} className="text-on-primary" />
                        ) : (
                          <Save size={14} />
                        )}
                      </IconButton>
                    )}
                    {canRemoveAt && (
                      <IconButton
                        onClick={() => handleRemove(index, item)}
                        variant="ghost"
                        aria-label={
                          removeAriaLabel
                            ? removeAriaLabel(item, index)
                            : `Remove item ${index + 1}`
                        }
                        className="shrink-0"
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    )}
                  </div>
                  {expanded && (
                    <div className="px-4 pb-4 pt-1">
                      {renderExpandedBody(
                        item,
                        (next) => handleUpdate(index, next),
                        index,
                      )}
                      {saveError && (
                        <InlineError className={cn('mt-2')}>{saveError}</InlineError>
                      )}
                    </div>
                  )}
                  {!expanded && saveError && (
                    <div className="px-4 pb-3">
                      <InlineError>{saveError}</InlineError>
                    </div>
                  )}
                  {removeError && (
                    <div className="px-4 pb-3">
                      <InlineError>{removeError}</InlineError>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
