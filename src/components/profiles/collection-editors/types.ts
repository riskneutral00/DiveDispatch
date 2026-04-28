import type { ReactNode } from 'react'

export type ItemUpdater<T> = (next: T) => void

export type RenderRow<T> = (
  item: T,
  update: ItemUpdater<T>,
  index: number,
) => ReactNode

export type RenderExpandedBody<T> = (
  item: T,
  update: ItemUpdater<T>,
  index: number,
) => ReactNode

export type RenderCardTitle<T> = (item: T, index: number) => ReactNode

export type ItemKey<T> = (item: T, index: number) => string

export type RemoveAriaLabel<T> = (item: T, index: number) => string
