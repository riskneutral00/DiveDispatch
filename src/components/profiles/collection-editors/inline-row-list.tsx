import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { ItemCard } from '@/components/ui/item-card'
import { cn } from '@/lib/utils/cn'
import type {
  ItemKey,
  RemoveAriaLabel,
  RenderRow,
} from './types'

interface InlineRowListProps<T> {
  label: string
  addLabel: string
  items: T[]
  onChange: (next: T[]) => void
  emptyItem: () => T
  renderRow: RenderRow<T>
  emptyMessage?: string
  minItems?: number
  maxItems?: number
  itemKey?: ItemKey<T>
  required?: boolean
  removeAriaLabel?: RemoveAriaLabel<T>
  className?: string
  hideEmptyState?: boolean
  surface?: 'tinted' | 'plain'
  showAdd?: boolean
}

export function InlineRowList<T>({
  label,
  addLabel,
  items,
  onChange,
  emptyItem,
  renderRow,
  emptyMessage,
  minItems = 0,
  maxItems,
  itemKey,
  required,
  removeAriaLabel,
  className,
  hideEmptyState = false,
  surface = 'tinted',
  showAdd = true,
}: InlineRowListProps<T>) {
  const canAdd = maxItems === undefined || items.length < maxItems
  const canRemoveAt = items.length > minItems

  const handleAdd = () => {
    onChange([...items, emptyItem()])
  }
  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }
  const handleUpdate = (index: number, next: T) => {
    onChange(items.map((item, i) => (i === index ? next : item)))
  }

  return (
    <div className={className}>
      <FormSectionHeader
        label={label}
        required={required}
        action={
          showAdd ? (
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
          ) : undefined
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
          <div className={cn('space-y-4')}>
            {items.map((item, index) => (
              <ItemCard
                key={itemKey ? itemKey(item, index) : index}
                onRemove={() => handleRemove(index)}
                canRemove={canRemoveAt}
                aria-label={
                  removeAriaLabel
                    ? removeAriaLabel(item, index)
                    : `Remove item ${index + 1}`
                }
                surface={surface}
              >
                {renderRow(item, (next) => handleUpdate(index, next), index)}
              </ItemCard>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
