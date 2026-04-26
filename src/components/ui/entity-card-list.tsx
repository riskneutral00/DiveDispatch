import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { ItemCard } from '@/components/ui/item-card'

export type EntityCardListLayout = 'grid' | 'stack'

interface EntityCardListProps<T> {
  label: string
  items: T[]
  onChange?: (next: T[]) => void
  emptyItem?: () => T
  renderCard: (item: T, update: (next: T) => void, index: number) => ReactNode
  addLabel: string
  emptyMessage?: string
  minItems?: number
  maxItems?: number
  itemKey?: (item: T, index: number) => string
  required?: boolean
  removeAriaLabel?: (item: T, index: number) => string
  className?: string
  onAdd?: () => void
  onRemove?: (item: T, index: number) => void
  layout?: EntityCardListLayout
  hideEmptyState?: boolean
}

const LAYOUT_CLASS: Record<EntityCardListLayout, string> = {
  grid: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3',
  stack: 'space-y-3',
}

export function EntityCardList<T>({
  label,
  items,
  onChange,
  emptyItem,
  renderCard,
  addLabel,
  emptyMessage,
  minItems = 0,
  maxItems,
  itemKey,
  required,
  removeAriaLabel,
  className,
  onAdd,
  onRemove,
  layout = 'grid',
  hideEmptyState = false,
}: EntityCardListProps<T>) {
  const canAdd = maxItems === undefined || items.length < maxItems
  const canRemoveAt = items.length > minItems

  const handleAdd = () => {
    if (onAdd) return onAdd()
    if (onChange && emptyItem) onChange([...items, emptyItem()])
  }
  const handleRemove = (index: number) => {
    if (onRemove) return onRemove(items[index], index)
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
          <Button type="button" size="sm" variant="secondary" onClick={handleAdd} disabled={!canAdd}>
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
          <div className={LAYOUT_CLASS[layout]}>
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
              >
                {renderCard(item, (next) => handleUpdate(index, next), index)}
              </ItemCard>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
