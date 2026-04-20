/* eslint-disable react-hooks/refs -- comments-ok stable-key cache: useMemo intentionally reads/writes a ref to diff prev items and mint new ids only for additions */
import { useMemo, useRef } from 'react'

let idCounter = 0
function generateId(): string {
  return `sk-${++idCounter}`
}

export function useStableKeys<T>(items: T[]): string[] {
  const ref = useRef<{ items: T[]; keys: string[] }>({ items: [], keys: [] })

  return useMemo(() => {
    const prev = ref.current
    if (prev.items === items) return prev.keys

    if (items.length === prev.items.length) {
      ref.current = { items, keys: prev.keys }
      return prev.keys
    }

    if (items.length > prev.items.length) {
      const added = items.length - prev.items.length
      const keys = [...prev.keys, ...Array.from({ length: added }, generateId)]
      ref.current = { items, keys }
      return keys
    }

    const keys: string[] = []
    for (const item of items) {
      const prevIdx = prev.items.indexOf(item)
      keys.push(prevIdx >= 0 ? prev.keys[prevIdx] : generateId())
    }
    ref.current = { items, keys }
    return keys
  }, [items])
}
