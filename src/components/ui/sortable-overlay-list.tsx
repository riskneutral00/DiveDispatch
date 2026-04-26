'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Trash2, Plus, GripVertical } from 'lucide-react'
import { DragDropProvider } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

const OVERLAY_LIST_HEIGHT = 380
const PAGE_SIZE = 10

interface SortableCardProps<T extends { slug: string; name?: string }> {
  slug: string
  index: number
  entry: T | undefined
  onRemove: () => void
  renderBadge: (entry: T) => ReactNode
  group: string
  removeAriaLabel: string
}

function SortableCard<T extends { slug: string; name?: string }>({
  slug,
  index,
  entry,
  onRemove,
  renderBadge,
  group,
  removeAriaLabel,
}: SortableCardProps<T>) {
  const { ref, handleRef, isDragging } = useSortable({ id: slug, index, group })
  return (
    <div
      ref={ref}
      className="glass-container reading-plane rounded-theme p-3 min-w-[140px]"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="flex items-start gap-1 mb-1">
        <span className="text-label font-bold w-5 text-center shrink-0 text-secondary">
          {index + 1}
        </span>
        <button /* design-ok: drag handle must be raw button for @dnd-kit handleRef */
          ref={handleRef}
          type="button"
          className="shrink-0 cursor-grab active:cursor-grabbing text-secondary hover:text-primary transition-colors duration-theme"
          aria-label="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
        <div className="flex-1" />
        <Button
          variant="destructive-ghost"
          size="sm"
          type="button"
          onClick={onRemove}
          aria-label={removeAriaLabel}
          className="shrink-0"
        >
          <Trash2 size={14} />
        </Button>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-body font-medium truncate text-primary">
          {entry?.name ?? slug}
        </p>
        {entry && <div>{renderBadge(entry)}</div>}
      </div>
    </div>
  )
}

export interface SortableOverlayListProps<T extends { slug: string; name?: string }> {
  slugs: string[]
  onChange: (slugs: string[]) => void
  entries: T[] | undefined
  filteredEntries: T[]
  addButtonLabel: string
  dialogTitle: string
  searchPlaceholder: string
  searchLabel: string
  noResultsText: string
  removeAriaLabel: string
  previousPageAriaLabel: string
  nextPageAriaLabel: string
  maxItems: number
  renderBadge: (entry: T) => ReactNode
  renderCandidate: (entry: T) => ReactNode
  filterBar?: ReactNode
  search: string
  onSearchChange: (v: string) => void
  onResetFilters?: () => void
  dndGroup: string
}

export function SortableOverlayList<T extends { slug: string; name?: string }>({
  slugs,
  onChange,
  entries,
  filteredEntries,
  addButtonLabel,
  dialogTitle,
  searchPlaceholder,
  searchLabel,
  noResultsText,
  removeAriaLabel,
  previousPageAriaLabel,
  nextPageAriaLabel,
  maxItems,
  renderBadge,
  renderCandidate,
  filterBar,
  search,
  onSearchChange,
  onResetFilters,
  dndGroup,
}: SortableOverlayListProps<T>) {
  const [showOverlay, setShowOverlay] = useState(false)
  const [page, setPage] = useState(0)

  const [prevSearch, setPrevSearch] = useState(search)
  if (search !== prevSearch) {
    setPrevSearch(search)
    setPage(0)
  }

  const slugToEntry = useMemo(
    () =>
      entries ? Object.fromEntries(entries.map((e) => [e.slug, e])) : ({} as Record<string, T>),
    [entries],
  )

  const [prevFilterLen, setPrevFilterLen] = useState(filteredEntries.length)
  if (filteredEntries.length !== prevFilterLen) {
    setPrevFilterLen(filteredEntries.length)
    setPage(0)
  }

  if (entries === undefined) {
    return (
      <div className="flex items-center justify-center py-6 text-primary">
        <Spinner />
      </div>
    )
  }

  const atMax = slugs.length >= maxItems
  const remove = (index: number) =>
    onChange(slugs.filter((_, i) => i !== index))
  const add = (slug: string) => {
    if (!slugs.includes(slug) && !atMax) onChange([...slugs, slug])
  }

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE))
  const safePage = Math.min(page, Math.max(0, totalPages - 1))
  const paginatedEntries = filteredEntries.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setPage(0)
            setShowOverlay(true)
          }}
          disabled={atMax}
        >
          <Plus size={14} className="mr-1" />
          {addButtonLabel}
        </Button>
        <span className="text-label text-secondary">
          {slugs.length}/{maxItems}
        </span>
      </div>

      {slugs.length > 0 && (
        <DragDropProvider
          onDragEnd={(event) => {
            const { source, target } = event.operation
            if (source && target && source.id !== target.id) {
              const oldIndex = slugs.indexOf(source.id as string)
              const newIndex = slugs.indexOf(target.id as string)
              if (oldIndex !== -1 && newIndex !== -1) {
                const next = [...slugs]
                const [moved] = next.splice(oldIndex, 1)
                next.splice(newIndex, 0, moved)
                onChange(next)
              }
            }
          }}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"> {/* design-ok */}
            {slugs.map((slug, index) => (
              <SortableCard
                key={slug}
                slug={slug}
                index={index}
                entry={slugToEntry[slug]}
                onRemove={() => remove(index)}
                renderBadge={renderBadge}
                group={dndGroup}
                removeAriaLabel={removeAriaLabel}
              />
            ))}
          </div>
        </DragDropProvider>
      )}

      <Dialog
        open={showOverlay}
        onClose={() => {
          setShowOverlay(false)
          onSearchChange('')
          onResetFilters?.()
        }}
        title={dialogTitle}
        size="lg"
      >
        <div className="space-y-4">
          {filterBar}
          <Input
            label={searchLabel}
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <div
            className="rounded-theme overflow-hidden flex flex-col glass-elevated bg-surface-elevated"
            style={{
              minHeight: OVERLAY_LIST_HEIGHT,
              maxHeight: OVERLAY_LIST_HEIGHT,
            }}
          >
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              {paginatedEntries.length > 0 ? (
                paginatedEntries.map((entry) => (
                  <button /* design-ok: candidate row with custom hover + border-b separator */
                    key={entry.slug}
                    type="button"
                    onClick={() => add(entry.slug)}
                    disabled={atMax}
                    className="w-full text-left px-3 py-2.5 text-body transition-colors duration-theme hover:opacity-80 text-primary border-b last:border-b-0 border-glass-border"
                  >
                    {renderCandidate(entry)}
                  </button>
                ))
              ) : (
                <p className="text-body text-secondary py-6 px-3">
                  {noResultsText}
                </p>
              )}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-3 py-2 shrink-0 border-t border-glass-border">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={safePage === 0}
                  aria-label={previousPageAriaLabel}
                >
                  <ChevronLeft size={14} />
                </Button>
                <span className="text-label text-secondary">
                  {safePage + 1} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={safePage >= totalPages - 1}
                  aria-label={nextPageAriaLabel}
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  )
}
